from django.db import models
from django.utils import timezone


class Broker(models.Model):
    name = models.CharField(max_length=255)
    primary_contact_email = models.EmailField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:  # pragma: no cover - simple repr
        return self.name


class Company(models.Model):
    legal_name = models.CharField(max_length=255)
    industry = models.CharField(max_length=255, blank=True)
    headquarters_city = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["legal_name"]

    def __str__(self) -> str:  # pragma: no cover - simple repr
        return self.legal_name


class TeamMember(models.Model):
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self) -> str:  # pragma: no cover - simple repr
        return self.full_name


class Submission(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        IN_REVIEW = "in_review", "In Review"
        CLOSED = "closed", "Closed"
        LOST = "lost", "Lost"

    class Priority(models.TextChoices):
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"

    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="submissions"
    )
    broker = models.ForeignKey(
        Broker, on_delete=models.PROTECT, related_name="submissions"
    )
    owner = models.ForeignKey(
        TeamMember, on_delete=models.PROTECT, related_name="submissions"
    )
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.NEW)
    priority = models.CharField(
        max_length=32, choices=Priority.choices, default=Priority.MEDIUM
    )
    summary = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover - simple repr
        return f"{self.company} ({self.status})"


class Contact(models.Model):
    submission = models.ForeignKey(
        Submission, on_delete=models.CASCADE, related_name="contacts"
    )
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:  # pragma: no cover - simple repr
        return self.name


class Document(models.Model):
    submission = models.ForeignKey(
        Submission, on_delete=models.CASCADE, related_name="documents"
    )
    title = models.CharField(max_length=255)
    doc_type = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    file_url = models.URLField(blank=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self) -> str:  # pragma: no cover - simple repr
        return self.title


class Note(models.Model):
    submission = models.ForeignKey(
        Submission, on_delete=models.CASCADE, related_name="notes"
    )
    author_name = models.CharField(max_length=255)
    body = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover - simple repr
        return f"{self.author_name} - {self.created_at:%Y-%m-%d}"
