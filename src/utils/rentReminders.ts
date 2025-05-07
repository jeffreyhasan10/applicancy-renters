import { typedSupabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export async function processRentReminders() {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Get all active reminders due today
    const { data: reminders, error: remindersError } = await typedSupabase
      .from("rent_reminders")
      .select(`
        *,
        tenant:tenants (
          name,
          phone
        ),
        rent:rents (
          flat:flats (
            name
          )
        )
      `)
      .eq("is_active", true)
      .eq("next_reminder_date", today);

    if (remindersError) throw remindersError;

    for (const reminder of reminders || []) {
      try {
        // Send WhatsApp message
        if (reminder.tenant?.phone) {
          await typedSupabase.from("whatsapp_messages").insert({
            tenant_id: reminder.tenant_id,
            rent_id: reminder.rent_id,
            message: reminder.message_template,
            recipient_phone: reminder.tenant.phone,
            sent_at: new Date().toISOString(),
            included_payment_link: false,
          });
        }

        // Update next reminder date
        const nextReminderDate = new Date();
        nextReminderDate.setMonth(nextReminderDate.getMonth() + 1);
        nextReminderDate.setDate(reminder.reminder_day);

        await typedSupabase
          .from("rent_reminders")
          .update({
            next_reminder_date: nextReminderDate.toISOString().split("T")[0],
          })
          .eq("id", reminder.id);

        // Update last reminder date in rents table
        await typedSupabase
          .from("rents")
          .update({
            last_reminder_date: today,
          })
          .eq("id", reminder.rent_id);

      } catch (error) {
        console.error(`Failed to process reminder ${reminder.id}:`, error);
      }
    }

    return { success: true, processedCount: reminders?.length || 0 };
  } catch (error) {
    console.error("Failed to process rent reminders:", error);
    return { success: false, error };
  }
}

// Function to check and create recurring rent records
export async function processRecurringRents() {
  try {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get all monthly rents that haven't been created for this month
    const { data: rents, error: rentsError } = await typedSupabase
      .from("rents")
      .select(`
        *,
        tenant:tenants (
          name,
          phone
        ),
        flat:flats (
          name
        )
      `)
      .eq("payment_frequency", "monthly")
      .lt("due_date", firstDayOfMonth.toISOString());

    if (rentsError) throw rentsError;

    for (const rent of rents || []) {
      try {
        // Create new rent record for this month
        const { data: newRent, error: newRentError } = await typedSupabase
          .from("rents")
          .insert({
            tenant_id: rent.tenant_id,
            flat_id: rent.flat_id,
            amount: rent.amount,
            due_date: format(new Date(today.getFullYear(), today.getMonth(), rent.reminder_day || 1), "yyyy-MM-dd"),
            is_paid: false,
            whatsapp_sent: false,
            custom_message: `Monthly rent for ${format(today, "MMMM yyyy")}`,
            payment_frequency: "monthly",
            reminder_day: rent.reminder_day,
          })
          .select()
          .single();

        if (newRentError) throw newRentError;

        // Create reminder if enabled
        if (rent.reminder_day) {
          const reminderDate = new Date(today.getFullYear(), today.getMonth(), rent.reminder_day);
          if (reminderDate < today) {
            reminderDate.setMonth(reminderDate.getMonth() + 1);
          }

          await typedSupabase.from("rent_reminders").insert({
            rent_id: newRent.id,
            tenant_id: rent.tenant_id,
            next_reminder_date: reminderDate.toISOString().split("T")[0],
            reminder_day: rent.reminder_day,
            is_active: true,
            amount: rent.amount,
            message_template: `Dear ${rent.tenant?.name}, your monthly rent of ₹${rent.amount} for ${rent.flat?.name} is due. Please ensure timely payment.`,
          });
        }
      } catch (error) {
        console.error(`Failed to process recurring rent ${rent.id}:`, error);
      }
    }

    return { success: true, processedCount: rents?.length || 0 };
  } catch (error) {
    console.error("Failed to process recurring rents:", error);
    return { success: false, error };
  }
} 