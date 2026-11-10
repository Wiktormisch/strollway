from django.urls import path

from planning import views

urlpatterns = [
    path("health/", views.health, name="health"),
]
