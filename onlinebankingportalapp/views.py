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
from decimal import Decimal

from onlinebankingportalapp.models import Account, BillPayment, EStatement, ExternalTransfer, Payee, ScheduledPayment, Transaction, Transfer
from onlinebankingportalapp.serializers import AccountSerializer, BillPaymentSerializer, EStatementSerializer, ExternalTransferActivitySerializer, ExternalTransferSerializer, PayeeSerializer, RegisterSerializer, ChangePasswordSerializer, ScheduledPaymentSerializer, TransactionSerializer, TransferActivitySerializer, TransferSerializer, ProfileSerializer

# Create your views here.

def index(request):
    return render(request, 'index.html')

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer


class LoginView(APIView):
    def post(self, request):
        try:
            content_type = request.content_type
            body_preview = request.body[:200].decode('utf-8', errors='replace') if request.body else "empty"
            print(f"[LOGIN] content_type={content_type}, body={body_preview}")
            username = request.data.get('username')
            password = request.data.get('password')
            print(f"[LOGIN] username={username}, password_set={bool(password)}")
        except Exception as e:
            print(f"[LOGIN] ERROR: {e}")
            return Response({"debug": f"Parse error: {str(e)}", "content_type": request.content_type}, status=status.HTTP_400_BAD_REQUEST)

        if not username or not password:
            return Response({"debug": "missing credentials", "received_username": username, "received_password": bool(password)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = authenticate(username=username, password=password)
        except Exception as e:
            print(f"[LOGIN] authenticate ERROR: {e}")
            return Response({"debug": f"authenticate error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if user is not None:
            refresh = RefreshToken.for_user(user)
            print(f"[LOGIN] success for {user.username}")
            return JsonResponse({
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'refresh': str(refresh),
                'access': str(refresh.access_token)
            }, status=status.HTTP_200_OK)
        else:
            print(f"[LOGIN] failed for {username}")
            return JsonResponse(
                {"detail": "invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )
            

class CurrentusersView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

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


class FundAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        account_id = request.data.get('account_id')
        amount = request.data.get('amount')

        if not account_id or not amount:
            return Response({'error': 'account_id and amount are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount))
            if amount <= 0:
                return Response({'error': 'Amount must be positive'}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError, ArithmeticError):
            return Response({'error': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            account = Account.objects.get(id=account_id, user=request.user)
        except Account.DoesNotExist:
            return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)

        account.balance += amount
        account.save()

        # Create a transaction record
        Transaction.objects.create(
            account=account,
            amount=amount,
            remark='Account funding'
        )

        return Response({
            'message': 'Account funded successfully',
            'account_id': account.id,
            'new_balance': str(account.balance),
            'currency': account.currency,
        }, status=status.HTTP_200_OK)


class RecentActivityView(APIView):
    """Combined recent activity: transactions, internal transfers, external transfers."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        account_ids = list(user.accounts.values_list('id', flat=True))

        # Gather all activity items
        activities = []

        # 1. Regular transactions
        transactions = Transaction.objects.filter(account__in=account_ids)
        tx_data = TransactionSerializer(transactions, many=True, context={'request': request}).data
        for item in tx_data:
            activities.append({
                'id': item['id'],
                'amount': item['amount'],
                'remark': item['remark'] or 'Transaction',
                'date': item['date'],
                'payment_method': item.get('payment_method', 'N/A'),
                'recipient_details': item.get('recipient_details', None),
            })

        # 2. Internal transfers (outgoing - user is sender)
        outgoing = Transfer.objects.filter(from_account__user=user)
        out_data = TransferActivitySerializer(outgoing, many=True, direction='outgoing', context={'request': request}).data
        for item in out_data:
            activities.append({
                'id': item['id'],
                'amount': item['amount'],
                'remark': item['remark'],
                'date': item['date'],
                'payment_method': item.get('payment_method', 'N/A'),
                'recipient_details': item.get('recipient_details', None),
            })

        # 3. Internal transfers (incoming - user is recipient)
        incoming = Transfer.objects.filter(to_account__user=user)
        in_data = TransferActivitySerializer(incoming, many=True, direction='incoming', context={'request': request}).data
        for item in in_data:
            activities.append({
                'id': item['id'],
                'amount': item['amount'],
                'remark': item['remark'],
                'date': item['date'],
                'payment_method': item.get('payment_method', 'N/A'),
                'recipient_details': item.get('recipient_details', None),
            })

        # 4. External transfers (outgoing only)
        external = ExternalTransfer.objects.filter(account__user=user)
        ext_data = ExternalTransferActivitySerializer(external, many=True, context={'request': request}).data
        for item in ext_data:
            activities.append({
                'id': item['id'],
                'amount': item['amount'],
                'remark': item['remark'],
                'date': item['date'],
                'payment_method': item.get('payment_method', 'N/A'),
                'recipient_details': item.get('recipient_details', None),
            })

        # Sort by date descending, limit to 5
        activities.sort(key=lambda x: x['date'], reverse=True)
        activities = activities[:5]

        return Response(activities)
