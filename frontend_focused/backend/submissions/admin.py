from django.contrib import admin

from . import models


@admin.register(models.Broker)
class BrokerAdmin(admin.ModelAdmin):
    list_display = ("name", "primary_contact_email")
    search_fields = ("name",)


@admin.register(models.Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("legal_name", "industry", "headquarters_city")
    search_fields = ("legal_name",)


@admin.register(models.TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ("full_name", "email")
    search_fields = ("full_name", "email")


class ContactInline(admin.TabularInline):
    model = models.Contact
    extra = 0


class DocumentInline(admin.TabularInline):
    model = models.Document
    extra = 0


class NoteInline(admin.TabularInline):
    model = models.Note
    extra = 0


@admin.register(models.Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("company", "broker", "owner", "status", "priority", "created_at")
    list_filter = ("status", "broker", "owner", "priority")
    search_fields = ("company__legal_name",)
    inlines = [ContactInline, DocumentInline, NoteInline]


@admin.register(models.Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ("name", "role", "submission")


@admin.register(models.Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "doc_type", "submission", "uploaded_at")


@admin.register(models.Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ("submission", "author_name", "created_at")

