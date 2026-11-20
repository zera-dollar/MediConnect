from rest_framework import generics, permissions

from .models import ActivityLedger
from .serializers import ActivityLedgerSerializer


class ActivityLedgerListView(generics.ListAPIView):
    serializer_class = ActivityLedgerSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ActivityLedger.objects.select_related('user')

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.role == 'ADMIN':
            queryset = self.queryset
            user_id = self.request.query_params.get('user_id')
            if user_id:
                queryset = queryset.filter(user_id=user_id)
            return queryset
        return self.queryset.filter(user=user)
