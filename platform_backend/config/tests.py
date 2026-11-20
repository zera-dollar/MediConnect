from django.test import SimpleTestCase, override_settings


@override_settings(
    DEBUG=False,
    CORS_ALLOW_ALL_ORIGINS=False,
    ALLOWED_HOSTS=['example.pythonanywhere.com'],
)
class DeploymentCorsTests(SimpleTestCase):
    def test_vercel_frontend_receives_cors_header_on_response(self):
        response = self.client.get(
            '/',
            HTTP_HOST='example.pythonanywhere.com',
            HTTP_ORIGIN='https://platformfrontend-delta.vercel.app',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response['access-control-allow-origin'],
            'https://platformfrontend-delta.vercel.app',
        )

    def test_vercel_frontend_can_make_authenticated_api_requests(self):
        response = self.client.options(
            '/api/auth/login/',
            HTTP_HOST='example.pythonanywhere.com',
            HTTP_ORIGIN='https://platformfrontend-delta.vercel.app',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='authorization,content-type',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response['access-control-allow-origin'],
            'https://platformfrontend-delta.vercel.app',
        )
        self.assertIn('authorization', response['access-control-allow-headers'])
        self.assertIn('content-type', response['access-control-allow-headers'])

    def test_untrusted_origin_is_not_allowed(self):
        response = self.client.options(
            '/api/auth/login/',
            HTTP_HOST='example.pythonanywhere.com',
            HTTP_ORIGIN='https://untrusted.example',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
        )

        self.assertNotIn('access-control-allow-origin', response)
