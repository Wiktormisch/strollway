from django.urls import path
from rest_framework.routers import DefaultRouter

from walks import views

router = DefaultRouter()
router.register("profiles", views.FamilyProfileViewSet, basename="profile")
router.register("walks", views.WalkViewSet, basename="walk")
router.register("stops", views.StopViewSet, basename="stop")

urlpatterns = [
    path("demo-data/", views.DemoDataView.as_view(), name="demo-data"),
    *router.urls,
]
