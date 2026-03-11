from django.db import models
from django.contrib.auth.models import User

# Create your models here.

class Account(models.Model):
    ACCOUNT_TYPES = [('checking', 'Checking'), ('savings', 'Savings'), ('loan', 'Loan')]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='accounts')
    name = models.CharField(max_length=100)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)   


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
    recipient_routing_number = models.CharField(max_length=9)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transfer_type = models.CharField(max_length=10, choices=[('ACH', 'ACH'), ('WIRE', 'Wire')])
    status = models.CharField(max_length=20, default='pending')
    timestamp = models.DateTimeField(auto_now_add=True)


class Payee(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payees')
    name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=50)
    routing_number = models.CharField(max_length=9)
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
    frequency = models.CharField(max_length=10, blank=True)  # e.g., 'monthly'
    status = models.CharField(max_length=20, default='scheduled')

