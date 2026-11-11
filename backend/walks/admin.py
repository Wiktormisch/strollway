from django.contrib import admin

from walks.models import FamilyProfile, Stop, Walk

admin.site.register(FamilyProfile)
admin.site.register(Walk)
admin.site.register(Stop)
