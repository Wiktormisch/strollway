"""Replace the two-value `pace` with a number in km/h (audit idea 3, W4).

Old values keep today's walking times: relaxed = 3.5, normal = 4.5, but normal with a
stroller was always limited to 4 km/h, so it becomes 4.0.
"""

import django.core.validators
from django.db import migrations, models


def pace_to_kmh(apps, schema_editor):
    FamilyProfile = apps.get_model("walks", "FamilyProfile")
    for profile in FamilyProfile.objects.all():
        if profile.pace == "normal":
            profile.pace_kmh = 4.0 if profile.wheels == "stroller" else 4.5
        else:
            profile.pace_kmh = 3.5
        profile.save(update_fields=["pace_kmh"])


def kmh_to_pace(apps, schema_editor):
    FamilyProfile = apps.get_model("walks", "FamilyProfile")
    for profile in FamilyProfile.objects.all():
        profile.pace = "relaxed" if profile.pace_kmh < 4.0 else "normal"
        profile.save(update_fields=["pace"])


class Migration(migrations.Migration):
    dependencies = [
        ("walks", "0004_stop_category_skatepark"),
    ]

    operations = [
        migrations.AddField(
            model_name="familyprofile",
            name="pace_kmh",
            field=models.FloatField(
                default=3.5,
                validators=[
                    django.core.validators.MinValueValidator(2.5),
                    django.core.validators.MaxValueValidator(5.5),
                ],
            ),
        ),
        migrations.RunPython(pace_to_kmh, kmh_to_pace),
        migrations.RemoveField(model_name="familyprofile", name="pace"),
    ]
