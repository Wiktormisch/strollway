"""Anonymous scoping by the X-Client-Id header.

There is no login. Each browser sends a random UUID in X-Client-Id. A missing header
(curl, Swagger) means the shared "demo" client. A header that is not a UUID gives 400.
"""

import uuid

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework.exceptions import ValidationError

CLIENT_ID_HEADER = "X-Client-Id"
DEMO_CLIENT_ID = "demo"

CLIENT_ID_PARAMETER = OpenApiParameter(
    name=CLIENT_ID_HEADER,
    type=OpenApiTypes.UUID,
    location=OpenApiParameter.HEADER,
    required=False,
    description=(
        "A random UUID that identifies this browser. All data is filtered by it. "
        'When it is missing, the shared "demo" client is used. A value that is not '
        "a UUID gives 400."
    ),
)


def get_client_id(request):
    """Return the normalized client id for this request, or raise 400."""
    raw = request.headers.get(CLIENT_ID_HEADER)
    if raw is None or raw.strip() == "":
        return DEMO_CLIENT_ID
    try:
        # str(UUID(...)) gives one lower-case form, so "ABC..." and "abc..." are the same client.
        return str(uuid.UUID(raw.strip()))
    except ValueError:
        raise ValidationError({CLIENT_ID_HEADER: "Must be a valid UUID."}) from None


class ClientIdMixin:
    """Reads the client id before any action, so a bad header gives 400 before a 404."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        request.client_id = get_client_id(request)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["client_id"] = getattr(self.request, "client_id", DEMO_CLIENT_ID)
        return context


class ClientScopedMixin(ClientIdMixin):
    """Filters the queryset by client and sets client_id on create.

    `client_lookup` is the path to client_id, e.g. "walk__client_id" for stops.
    A foreign object is not in the queryset, so DRF returns 404 for it.
    """

    client_lookup = "client_id"

    def get_queryset(self):
        return super().get_queryset().filter(**{self.client_lookup: self.request.client_id})

    def perform_create(self, serializer):
        if self.client_lookup == "client_id":
            serializer.save(client_id=self.request.client_id)
        else:
            serializer.save()
