from django.db import models
from django.contrib.auth.models import User
import random

# Create your models here.

def generate_account_number():
    """Generate a unique 10-digit account number."""
    while True:
        number = str(random.randint(1000000000, 9999999999))
        if not Account.objects.filter(account_number=number).exists():
            return number


class Account(models.Model):
    ACCOUNT_TYPES = [('checking', 'Checking'), ('savings', 'Savings'), ('loan', 'Loan')]
    CURRENCIES = [('NGN', 'Naira (₦)'), ('USD', 'Dollar ($)')]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='accounts')
    name = models.CharField(max_length=100)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)
    currency = models.CharField(max_length=3, choices=CURRENCIES, default='NGN')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    account_number = models.CharField(max_length=10, unique=True, null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.account_number:
            self.account_number = generate_account_number()
        super().save(*args, **kwargs)


class Transaction(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    remark = models.CharField(max_length=200)
    date = models.DateTimeField(auto_now_add=True)   


class EStatement(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='statements')
    month = models.DateField()  # Store as first day of the month (e.g., 2025-01-01)
    pdf_file = models.FileField(upload_to='statements/')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('account', 'month')
        ordering = ['-month']


class Transfer(models.Model):
    from_account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='outgoing_transfers')
    to_account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='incoming_transfers')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    timestamp = models.DateTimeField(auto_now_add=True)
    description = models.CharField(max_length=200, blank=True)



class ExternalTransfer(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='outgoing_external')
    recipient_name = models.CharField(max_length=100)
    recipient_account_number = models.CharField(max_length=50)
    recipient_routing_number = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transfer_type = models.CharField(max_length=20, choices=[('ACH', 'ACH'), ('WIRE', 'Wire'), ('NIP', 'NIP'), ('BANK_TRANSFER', 'Bank Transfer')])
    status = models.CharField(max_length=20, default='pending')
    timestamp = models.DateTimeField(auto_now_add=True)


class Payee(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payees')
    name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=50)
    routing_number = models.CharField(max_length=100)
    nickname = models.CharField(max_length=50, blank=True)


class BillPayment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    payee = models.ForeignKey(Payee, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default='pending')
    timestamp = models.DateTimeField(auto_now_add=True)


class ScheduledPayment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    payee = models.ForeignKey(Payee, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    schedule_date = models.DateField()  # Future date
    is_recurring = models.BooleanField(default=False)
    frequency = models.CharField(max_length=10, blank=True) 
    status = models.CharField(max_length=20, default='scheduled')

