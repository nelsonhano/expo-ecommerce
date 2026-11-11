export const capitalizeText = (text) => {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const getOrderStatusBadge = (status) => {
  switch (status?.toLowerCase()) {
    case "delivered":
      return "badge-success";
    case "shipped":
      return "badge-info";
    case "pending":
      return "badge-warning";
    case "cancelled":
      return "badge-error";
    default:
      return "badge-ghost";
  }
};

const CANCEL_REASON_LABELS = {
  sold_out: "sold out",
  capture_failed: "payment failed",
  authorization_expired: "authorization expired",
};

// orders that can't move through fulfilment get a fixed badge instead of the status dropdown
// (spec 0001, AC-10 / AC-11). Returns null for a captured order the admin can update.
export const getLockedOrderBadge = (order) => {
  if (order.status === "cancelled") {
    const reason = CANCEL_REASON_LABELS[order.cancelReason];
    return { text: reason ? `Cancelled (${reason})` : "Cancelled", class: "badge-error" };
  }
  if (order.paymentResult?.status === "authorized") {
    return { text: "Awaiting capture", class: "badge-warning" };
  }
  return null;
};

export const getStockStatusBadge = (stock) => {
  if (stock === 0) return { text: "Out of Stock", class: "badge-error" };
  if (stock < 20) return { text: "Low Stock", class: "badge-warning" };
  return { text: "In Stock", class: "badge-success" };
};

export const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};
