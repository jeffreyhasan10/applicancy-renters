import { processRentReminders, processRecurringRents } from "@/utils/rentReminders";

// Run the worker every hour
const INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

async function runWorker() {
  console.log("Running rent worker...");

  try {
    // Process rent reminders
    const remindersResult = await processRentReminders();
    console.log("Rent reminders processed:", remindersResult);

    // Process recurring rents
    const recurringResult = await processRecurringRents();
    console.log("Recurring rents processed:", recurringResult);
  } catch (error) {
    console.error("Error in rent worker:", error);
  }

  // Schedule next run
  setTimeout(runWorker, INTERVAL);
}

// Start the worker
runWorker(); 