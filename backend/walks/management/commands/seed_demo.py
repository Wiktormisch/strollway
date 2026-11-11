from django.core.management.base import BaseCommand

from walks.demo_data import create_demo_data
from walks.scoping import DEMO_CLIENT_ID


class Command(BaseCommand):
    help = 'Create demo data for the shared "demo" client. Safe to run many times.'

    def handle(self, *args, **options):
        if create_demo_data(DEMO_CLIENT_ID):
            self.stdout.write(self.style.SUCCESS("Demo data created."))
        else:
            self.stdout.write("Demo data already exists. Nothing changed.")
