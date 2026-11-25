# UI/UX Guidelines

## Product Audience
The application targets residents of a specific town in Beheira, Egypt. Many users may have limited technical experience.

The interface must be understandable to people who are not comfortable with technology.

## Language and Direction
- Patient-facing interface must use natural Egyptian Arabic (عامية مصرية).
- Use RTL layout throughout Arabic interfaces.
- Avoid formal Arabic and literal English translations.
- Use familiar words instead of technical terminology.
- Admin dashboards should also support Arabic RTL.

## Design Principles
- Mobile-first and fully responsive.
- Simple, clean, and uncluttered layouts.
- Large readable typography.
- Large touch-friendly buttons.
- Clear visual hierarchy.
- Minimal steps to complete a booking.
- Avoid unnecessary dialogs and confirmation steps.
- Show only information relevant to the current task.

## Homepage
The homepage should immediately communicate the purpose of the platform.

Main heading:
"عايز تكشف عند دكتور إيه؟"

Two primary actions:
1. "احجز عند دكتور"
2. "عندي حجز بالفعل"

These actions must be visually prominent.

## Patient Booking Experience
- Display specialties using clear names and recognizable icons.
- Doctor cards should display the doctor's photo, name, specialty, short description, clinic name, address, and consultation fee.
- Show available dates after selecting a doctor.
- Show available time slots after selecting a date.
- Keep the booking form short: patient name and phone number.
- Display a clear confirmation page with booking reference, QR code, doctor, clinic, date, and time.

## Booking Management
- Allow lookup using booking reference or phone number.
- If multiple appointments match a phone number, display them clearly.
- Use simple action labels:
  - "غيّر معادك"
  - "إلغاء الحجز"
- Use understandable cancellation confirmation messages.

## Visual Design
- Use a consistent design system.
- Maintain consistent spacing, typography, colors, and border radii.
- Use accessible contrast.
- Use subtle animations only when they improve feedback or navigation.
- Avoid excessive gradients, decorative effects, and unnecessary motion.
- Provide clear loading, empty, success, and error states.

## Accessibility
- Buttons must have clear labels.
- Forms must have visible labels.
- Errors must explain how to fix the problem.
- Do not communicate status through color alone.
- Ensure controls are usable on small screens.

## Important
Do not invent a different booking flow or add unnecessary UI steps.

Prioritize usability and clarity over visual complexity.