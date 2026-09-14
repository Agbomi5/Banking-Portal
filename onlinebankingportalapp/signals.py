from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User


@receiver(post_save, sender=User)
def sync_account_names(sender, instance, **kwargs):
    instance.accounts.update(name=instance.username)
