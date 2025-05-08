import { format, isValid, parseISO } from "date-fns";

interface RentMessageParams {
  tenantName: string;
  flatName: string;
  amount: number;
  dueDate: string;
  months?: string[];
  paymentLink?: string;
  inventoryItems?: Array<{ name: string; rent: number }>;
}

export const generateRentReminderMessage = ({
  tenantName,
  flatName,
  amount,
  dueDate,
  months,
  paymentLink,
  inventoryItems,
}: RentMessageParams): string => {
  const dueDateFormatted =
    dueDate && isValid(parseISO(dueDate))
      ? format(parseISO(dueDate), "dd MMM yyyy")
      : "N/A";

  const monthsList = months?.join(", ") || format(parseISO(dueDate), "MMMM yyyy");
  const totalAmount = months ? amount * months.length : amount;

  let message = `Dear ${tenantName},\nGreetings!\n\n`;
  message += `Upcoming payment of your monthly furniture rent for month of ${monthsList} is due on *${dueDateFormatted}*\n\n`;
  message += `Payment due is *Rs ${totalAmount.toLocaleString()}*\n\n`;

  if (inventoryItems && inventoryItems.length > 0) {
    message += `Inventory items:\n`;
    inventoryItems.forEach((item) => {
      if (item.name && item.rent > 0) {
        message += `- ${item.name}: ₹${item.rent.toLocaleString()}\n`;
      }
    });
    message += "\n";
  }

  if (paymentLink) {
    message += `Please make the payment using the link below:\n${paymentLink}\n\n`;
  }

  message += `Please pay the rent to avoid any miss payment.\n\n`;
  message += `Thank you\n*Applicancy Renters*`;

  return message;
};

export const generateMaintenanceMessage = (
  tenantName: string,
  flatName: string,
  title: string,
  description?: string,
  priority: string = "medium"
): string => {
  let message = `Dear ${tenantName},\nGreetings!\n\n`;
  message += `Maintenance Update for ${flatName}\n\n`;
  message += `Issue: ${title}\n`;
  message += `Priority: ${priority.toUpperCase()}\n`;
  if (description) {
    message += `Details: ${description}\n`;
  }
  message += `\nOur maintenance team will address this issue promptly.\n\n`;
  message += `Thank you for your patience.\nApplicancy Renters`;

  return message;
};

export const generatePaymentConfirmationMessage = (
  tenantName: string,
  flatName: string,
  amount: number,
  paymentDate: string
): string => {
  const paymentDateFormatted =
    paymentDate && isValid(parseISO(paymentDate))
      ? format(parseISO(paymentDate), "dd MMM yyyy")
      : "N/A";

  let message = `Dear ${tenantName},\nGreetings!\n\n`;
  message += `We have received your rent payment of INR Rs ${amount.toLocaleString()} for ${flatName} on ${paymentDateFormatted}.\n\n`;
  message += `Thank you for your timely payment.\n\n`;
  message += `Best regards,\nApplicancy Renters`;

  return message;
}; 