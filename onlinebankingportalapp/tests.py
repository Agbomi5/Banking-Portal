from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient


class LoginViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        User.objects.create_user(username='MobileUser', password='correct-password')

    def test_login_accepts_username_regardless_of_mobile_keyboard_case(self):
        response = self.client.post(
            '/login/',
            {'username': 'mobileuser', 'password': 'correct-password'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.json())

    def test_login_keeps_password_case_sensitive(self):
        response = self.client.post(
            '/login/',
            {'username': 'MOBILEUSER', 'password': 'Correct-Password'},
            format='json',
        )

        self.assertEqual(response.status_code, 401)

    def test_login_without_trailing_slash_reaches_the_same_view(self):
        response = self.client.post(
            '/login',
            {'username': 'MobileUser', 'password': 'correct-password'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
