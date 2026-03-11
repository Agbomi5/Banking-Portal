from django.http import JsonResponse
from django.shortcuts import render
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.generics import RetrieveAPIView, CreateAPIView, DestroyAPIView, ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend

from onlinebankingportalapp.models import Account, BillPayment, EStatement, Payee, ScheduledPayment, Transaction
from onlinebankingportalapp.serializers import AccountSerializer, BillPaymentSerializer, EStatementSerializer, ExternalTransferSerializer, PayeeSerializer, RegisterSerializer, ChangePasswordSerializer, ScheduledPaymentSerializer, TransactionSerializer, TransferSerializer, TransferSerializer

# Create your views here.

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer


class LoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        user = authenticate(username=username, password=password)

        if user is not None:

            refresh = RefreshToken.for_user(user)

            return JsonResponse({
                'username': (username),

                'refresh': str(refresh),
                
                'access': str(refresh.access_token)
            }, status=status.HTTP_200_OK)
            
        else:
            return JsonResponse(
                {"detail": "invalid credentials"},
                 status=status.HTTP_401_UNAUTHORIZED
             )
            

class CurrentusersView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [IsAuthenticated]
    #lookup_field = 'id'

    def get_object(self):
        return self.request.user
    

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.data.get('old_password')):
                return Response({'old_password': ['Wrong password.']}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(serializer.data.get('new_password'))
            user.save()
            # Update session to prevent logout
            from django.contrib.auth import update_session_auth_hash
            update_session_auth_hash(request, user)
            return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserAccountsView(generics.ListAPIView):
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.accounts.all()   
    

class AccountDetailView(RetrieveAPIView):
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Account.objects.filter(user=self.request.user)
    


class AccountTransactionsView(generics.ListAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['date']
    search_fields = ['remark']

    def get_queryset(self):
        account_id = self.kwargs['account_id']
        return Transaction.objects.filter(account_id=account_id, account__user=self.request.user)   
    


class AccountStatementsView(ListAPIView):
    serializer_class = EStatementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        account_id = self.kwargs['account_id']
        return EStatement.objects.filter(
            account_id=account_id,
            account__user=self.request.user
        ).order_by('-month')   
    


class TransferView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TransferSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    

class ExternalTransferView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ExternalTransferSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class TransactionDetailView(RetrieveAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(account__user=self.request.user)
    

class PayeeListView(ListAPIView):
    serializer_class = PayeeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Payee.objects.filter(user=self.request.user)
    

class AddPayeeView(CreateAPIView):
    serializer_class = PayeeSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BillPaymentView(CreateAPIView):
    serializer_class = BillPaymentSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        payment = serializer.save(user=self.request.user)
        # Deduct from user's account (assuming primary account)
        account = self.request.user.accounts.first()
        account.balance -= payment.amount
        account.save()


class SchedulePaymentView(CreateAPIView):
    serializer_class = ScheduledPaymentSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user) 


class PendingPaymentsListView(ListAPIView):
    serializer_class = BillPaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BillPayment.objects.filter(
            user=self.request.user,
            status__in=['pending', 'scheduled']
        ).order_by('timestamp')  


class CancelScheduledPaymentView(DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ScheduledPayment.objects.filter(user=self.request.user, status='scheduled')
