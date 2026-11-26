const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function formatConsultationFee(value: string): string {
  return `${numberFormatter.format(Number(value))} جنيه`;
}

export function formatExperienceYears(years: number | null): string | null {
  return years === null ? null : `${numberFormatter.format(years)} سنين خبرة`;
}
