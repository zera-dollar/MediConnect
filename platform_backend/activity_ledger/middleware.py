from django.contrib.auth import get_user_model

from .models import ActivityLedger


class ActivityLedgerMiddleware:
    update_actions = {
        'adjust',
        'cancel',
        'change-password',
        'check_in',
        'check_out',
        'close',
        'dispatch',
        'location',
        'mark_all_read',
        'mark_read',
        'publish',
        'review',
        'status',
    }

    event_by_method = {
        'POST': ActivityLedger.EventType.CREATE,
        'PUT': ActivityLedger.EventType.UPDATE,
        'PATCH': ActivityLedger.EventType.UPDATE,
        'DELETE': ActivityLedger.EventType.DELETE,
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if (
            not request.path.startswith('/api/')
            or request.method not in self.event_by_method
            or response.status_code >= 400
        ):
            return response

        user = getattr(request, 'user', None)
        event_type = self.event_by_method[request.method]
        if request.path == '/api/auth/login/':
            user_id = response.data['user']['id']
            user = get_user_model().objects.get(pk=user_id)
            event_type = ActivityLedger.EventType.LOGIN
        elif request.path == '/api/auth/register/':
            user_id = response.data['id']
            user = get_user_model().objects.get(pk=user_id)
            event_type = ActivityLedger.EventType.REGISTER

        if not user or not user.is_authenticated:
            return response

        path_parts = [part for part in request.path.strip('/').split('/') if part]
        resource_type = '/'.join(part for part in path_parts[1:] if not part.isdigit())[:100]
        if (
            request.method == 'POST'
            and event_type == ActivityLedger.EventType.CREATE
            and (
                any(part.isdigit() for part in path_parts)
                or path_parts[-1] in self.update_actions
            )
        ):
            event_type = ActivityLedger.EventType.UPDATE
        resource_id = next(
            (part for part in reversed(path_parts) if part.isdigit()),
            '',
        )
        response_data = getattr(response, 'data', None)
        if not resource_id and request.method == 'POST' and isinstance(response_data, dict):
            resource_id = str(response_data.get('id', ''))

        ActivityLedger.objects.create(
            user=user,
            event_type=event_type,
            resource_type=resource_type or 'api',
            resource_id=resource_id[:64],
            method=request.method,
            endpoint=request.path[:255],
            response_status=response.status_code,
        )
        return response
