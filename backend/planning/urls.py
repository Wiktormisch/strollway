from django.urls import path

from planning import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("route-plans/", views.RoutePlanView.as_view(), name="route-plans"),
    path("best-walk-time/", views.BestTimeView.as_view(), name="best-walk-time"),
    path("places/search/", views.PlaceSearchView.as_view(), name="place-search"),
    path("trip-ideas/", views.TripIdeaView.as_view(), name="trip-ideas"),
]
