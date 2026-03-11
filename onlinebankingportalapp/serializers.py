from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password

from onlinebankingportalapp.models import Account, BillPayment, EStatement, ExternalTransfer, Payee, ScheduledPayment, Transaction, Transfer

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    #password2 = serializers.CharField(write_only=True, required=True)


    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'age', 'address', 'phone_number']
        extra_kwargs = {
            'password': {'write_only': True}
        }
    
    # def validate(self, attrs):
    #     if attrs['password'] != attrs['password2']:
    #         raise serializers.ValidationError({"password": "Invalid didn't match"})
    #     return attrs
    
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            age=validated_data['age'],
            address=validated_data['address'],
            phone_number=validated_data['phone_number']
        )

        return user
    

class ChangePasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(required=True)

    def validate_new_password(self, value):
        # Add your password validation logic here
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        
        validate_password(value)
        return value


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['id', 'name', 'account_type', 'balance']   


# serializers.py
class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'amount', 'remark', 'date']   


class EStatementSerializer(serializers.ModelSerializer):
    class Meta:
        model = EStatement
        fields = ['id', 'month', 'created_at']



class TransferSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transfer
        fields = ['from_account', 'to_account', 'amount', 'description']

    def validate(self, data):
        if data['from_account'].user != self.context['request'].user:
            raise serializers.ValidationError("Source account not owned by user.")
        if data['to_account'].user != self.context['request'].user:
            raise serializers.ValidationError("Destination account not owned by user.")
        if data['amount'] <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        if data['from_account'].balance < data['amount']:
            raise serializers.ValidationError("Insufficient funds.")
        return data

    def create(self, validated_data):
        from_account = validated_data['from_account']
        to_account = validated_data['to_account']
        amount = validated_data['amount']

        from_account.balance -= amount
        to_account.balance += amount

        from_account.save()
        to_account.save()

        return Transfer.objects.create(**validated_data)



class ExternalTransferSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalTransfer
        fields = ['account', 'recipient_name', 'recipient_account_number', 'recipient_routing_number', 'amount', 'transfer_type']

    def validate_account(self, value):
        if value.user != self.context['request'].user:
            raise serializers.ValidationError("Account not owned by user.")
        return value

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value

    def create(self, validated_data):
        account = validated_data['account']
        amount = validated_data['amount']
        if account.balance < amount:
            raise serializers.ValidationError("Insufficient funds.")
        account.balance -= amount
        account.save()
        return ExternalTransfer.objects.create(**validated_data)


class PayeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payee
        fields = ['id', 'name', 'nickname', 'account_number']


class BillPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillPayment
        fields = ['payee', 'amount']

    def validate_payee(self, value):
        if value.user != self.context['request'].user:
            raise serializers.ValidationError("Payee not associated with user.")
        return value

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value


class ScheduledPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduledPayment
        fields = ['payee', 'amount', 'schedule_date', 'is_recurring', 'frequency']



