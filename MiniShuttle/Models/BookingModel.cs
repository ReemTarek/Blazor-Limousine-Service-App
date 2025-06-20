using System.ComponentModel.DataAnnotations;

namespace MiniShuttle.Models
{
    public class BookingRequest
    {
        public string Id { get; set; } = "";
        [Required]
        public string PickupAddress { get; set; } = "";
        [Required]
        public string DestinationAddress { get; set; } = "";
        public double PickupLat { get; set; }
        public double PickupLng { get; set; }
        public double DestinationLat { get; set; }
        public double DestinationLng { get; set; }
        [Required]
        public ServiceType ServiceType { get; set; }
        [Required]
        public DateTime BookingDateTime { get; set; } = DateTime.Now.AddHours(1);
        public double EstimatedDistance { get; set; }
        public int EstimatedDuration { get; set; }
        public decimal EstimatedCost { get; set; }
        public bool IsRoundTrip { get; set; }
        public DateTime ReturnRoundDateTime { get; set; }= DateTime.Now.AddHours(1);
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public BookingStatus Status { get; set; } = BookingStatus.Pending;
    }

    public enum ServiceType
    {
        Standard = 1,
        Premium = 2,
        Luxury = 3
    }

    public enum BookingStatus
    {
        Pending,
        Confirmed,
        InProgress,
        Completed,
        Cancelled
    }
}
