from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class GameManager(models.Manager):
    def visible_to(self, user):
        """Staff see every game; everyone else only ACTIVE ones."""
        if user.is_authenticated and user.is_staff:
            return self.get_queryset()
        return self.get_queryset().filter(status=self.model.Status.ACTIVE)


class Game(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField()
    developer = models.CharField(max_length=200)
    publisher = models.CharField(max_length=200)
    release_date = models.DateField()
    cover_image = models.URLField(max_length=500, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="games")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = GameManager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=("ACTIVE", "INACTIVE")),
                name="game_status_valid",
            )
        ]

    def __str__(self):
        return self.name
