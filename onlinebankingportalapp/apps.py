from django.apps import AppConfig


class OnlinebankingportalappConfig(AppConfig):
    name = 'onlinebankingportalapp'

    def ready(self):
        import onlinebankingportalapp.signals
