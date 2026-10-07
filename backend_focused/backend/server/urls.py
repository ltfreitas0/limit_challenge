"""Root URL configuration for the Fleet Tracker API.

Everything is exposed under ``/api/``. All endpoints require authentication
except the JWT token endpoints.
"""

from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Public JWT endpoints.
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Authenticated fleet endpoints.
    path("api/", include("fleet.urls")),
]
