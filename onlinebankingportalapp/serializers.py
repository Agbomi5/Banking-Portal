from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password

from onlinebankingportalapp.models import Account, BillPayment, EStatement, ExternalTransfer, Payee, ScheduledPayment, Transaction, Transfer, generate_account_number

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
        )

        # Auto-create both Naira and Dollar checking accounts for the new user
        Account.objects.create(
            user=user,
            name=validated_data['username'],
            account_type='checking',
            currency='NGN',
            balance=0.00,
        )
        Account.objects.create(
            user=user,
            name=validated_data['username'],
            account_type='checking',
            currency='USD',
            balance=0.00,
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
        fields = ['id', 'name', 'account_type', 'currency', 'balance', 'account_number']   


# serializers.py
class TransactionSerializer(serializers.ModelSerializer):
    payment_method = serializers.SerializerMethodField()
    recipient_details = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = ['id', 'amount', 'remark', 'date', 'payment_method', 'recipient_details']

    def get_payment_method(self, obj):
        return 'Account Transaction'

    def get_recipient_details(self, obj):
        account = obj.account
        return {
            'name': account.name if account else 'Unknown',
            'account_number': account.account_number if account else 'N/A'
        }   


class EStatementSerializer(serializers.ModelSerializer):
    class Meta:
        model = EStatement
        fields = ['id', 'month', 'created_at']



class TransferSerializer(serializers.ModelSerializer):
    from_account = serializers.IntegerField(write_only=True)
    to_account = serializers.CharField(write_only=True, max_length=10)

    class Meta:
        model = Transfer
        fields = ['from_account', 'to_account', 'amount', 'description']
        extra_kwargs = {
            'from_account': {'write_only': True},
            'to_account': {'write_only': True},
        }

    def validate_to_account(self, value):
        """Convert account number to account ID."""
        try:
            account = Account.objects.get(account_number=value)
            return account.id
        except Account.DoesNotExist:
            raise serializers.ValidationError("Destination account not found.")

    def validate_from_account(self, value):
        """Verify from_account belongs to current user."""
        request = self.context.get('request')
        if request:
            try:
                account = Account.objects.get(id=value, user=request.user)
            except Account.DoesNotExist:
                raise serializers.ValidationError("Source account not found.")
        return value

    def validate(self, data):
        if data['amount'] <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return data

    def create(self, validated_data):
        from_account = Account.objects.get(id=validated_data['from_account'])
        to_account = Account.objects.get(id=validated_data['to_account'])
        amount = validated_data['amount']

        if from_account.balance < amount:
            raise serializers.ValidationError("Insufficient funds.")

        from_account.balance -= amount
        to_account.balance += amount

        from_account.save()
        to_account.save()

        return Transfer.objects.create(
            from_account=from_account,
            to_account=to_account,
            amount=amount,
            description=validated_data.get('description', '')
        )

        return Transfer.objects.create(
            from_account=from_account,
            to_account=to_account,
            amount=amount,
            description=validated_data.get('description', '')
        )



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


class TransferActivitySerializer(serializers.ModelSerializer):
    """Serializer for Transfer records shown in recent activity."""
    amount = serializers.SerializerMethodField()
    remark = serializers.SerializerMethodField()
    date = serializers.DateTimeField(source='timestamp')
    payment_method = serializers.SerializerMethodField()
    recipient_details = serializers.SerializerMethodField()

    class Meta:
        model = Transfer
        fields = ['id', 'amount', 'remark', 'date', 'payment_method', 'recipient_details']

    def __init__(self, *args, **kwargs):
        self.direction = kwargs.pop('direction', 'outgoing')
        super().__init__(*args, **kwargs)

    def get_amount(self, obj):
        if self.direction == 'outgoing':
            return str(-obj.amount)
        return str(obj.amount)

    def get_remark(self, obj):
        if self.direction == 'outgoing':
            recipient = obj.to_account.name if obj.to_account else 'Unknown'
            return f"Transfer to {recipient}"
        sender = obj.from_account.name if obj.from_account else 'Unknown'
        return f"Transfer from {sender}"

    def get_payment_method(self, obj):
        return 'Internal Transfer'

    def get_recipient_details(self, obj):
        if self.direction == 'outgoing':
            recipient = obj.to_account
            return {
                'name': recipient.name if recipient else 'Unknown',
                'account_number': recipient.account_number if recipient else 'N/A'
            }
        sender = obj.from_account
        return {
            'name': sender.name if sender else 'Unknown',
            'account_number': sender.account_number if sender else 'N/A'
        }


class ExternalTransferActivitySerializer(serializers.ModelSerializer):
    """Serializer for ExternalTransfer records shown in recent activity."""
    amount = serializers.SerializerMethodField()
    remark = serializers.SerializerMethodField()
    date = serializers.DateTimeField(source='timestamp')
    payment_method = serializers.SerializerMethodField()
    recipient_details = serializers.SerializerMethodField()

    class Meta:
        model = ExternalTransfer
        fields = ['id', 'amount', 'remark', 'date', 'payment_method', 'recipient_details']

    def get_amount(self, obj):
        return str(-obj.amount)

    def get_remark(self, obj):
        return f"External Transfer to {obj.recipient_name}"

    def get_payment_method(self, obj):
        return obj.transfer_type or 'External Transfer'

    def get_recipient_details(self, obj):
        return {
            'name': obj.recipient_name,
            'account_number': obj.recipient_account_number,
            'routing_number': obj.recipient_routing_number
        }



