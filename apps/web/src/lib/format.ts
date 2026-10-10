const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return dateTimeFormatter.format(date);
};

export const formatDate = (value: string | null | undefined): string => {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return dateFormatter.format(date);
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
};

export const getInitials = (value: string | null | undefined): string => {
  if (!value) {
    return "MG";
  }

  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "MG";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
};

export const pluralize = (
  count: number,
  singular: string,
  plural = `${singular}s`
): string => `${count} ${count === 1 ? singular : plural}`;
