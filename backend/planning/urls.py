from django.urls import path

from planning import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("route-plans/", views.RoutePlanView.as_view(), name="route-plans"),
    path("trip-ideas/", views.TripIdeaView.as_view(), name="trip-ideas"),
]
