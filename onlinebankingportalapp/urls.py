from  django.urls import path
from django.conf import settings
from django.views.static import serve
# from onlinebankingportalapp.views import (
#     RegisterView,                                                                   
#     LoginView,
#     CurrentusersView,
#     ChangePasswordView,
#     AccountListView,
#     TransactionListView,
#     EStatementListView,
#     TransferView,
#     ExternalTransferView,
#     PayeeListView,
#     BillPaymentView,
#     ScheduledPaymentView,
# )                   
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('profile/', views.CurrentusersView.as_view(), name='current-user-profile'),
    path('profile/password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('accounts/', views.UserAccountsView.as_view(), name='account-list'),
    path('accounts/<int:pk>/', views.AccountDetailView.as_view(), name='account-detail'),
    path('accounts/<int:account_id>/transactions/', views.AccountTransactionsView.as_view(), name='account-transactions'),
    path('accounts/<int:account_id>/statements/', views.AccountStatementsView.as_view(), name='account-statements'),
    path('transactions/transfer/', views.TransferView.as_view(), name='internal-transfer'),
    path('transactions/external/', views.ExternalTransferView.as_view(), name='external-transfer'),
    path('transactions/<int:pk>/', views.TransactionDetailView.as_view(), name='transaction-detail'),
    path('recent-activity/', views.RecentActivityView.as_view(), name='recent-activity'),
    path('payees/', views.PayeeListView.as_view(), name='payee-list'),
    path('payees/add/', views.AddPayeeView.as_view(), name='add-payee'),
    path('bills/pay/', views.BillPaymentView.as_view(), name='bill-payment'),
    path('bills/schedule/', views.SchedulePaymentView.as_view(), name='schedule-payment'),
    path('bills/pending/', views.PendingPaymentsListView.as_view(), name='pending-payments'),
    path('bills/schedule/<int:pk>/', views.CancelScheduledPaymentView.as_view(), name='cancel-scheduled-payment'),
    path('accounts/fund/', views.FundAccountView.as_view(), name='fund-account'),
] + [
    path('static/<path:path>', serve, {'document_root': settings.BASE_DIR / 'static'}),
]