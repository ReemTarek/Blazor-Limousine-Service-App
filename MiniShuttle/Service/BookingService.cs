using MiniShuttle.Models;

namespace MiniShuttle.Service
{
    public class BookingService
    {
        private readonly List<BookingRequest> _bookings = new();

        public string CreateBooking(BookingRequest booking)
        {
            booking.Id = "REQ#" + DateTime.Now.Ticks.ToString()[10..];
            booking.CreatedAt = DateTime.Now;
            booking.Status = BookingStatus.Confirmed;

            _bookings.Add(booking);

            return booking.Id;
        }

        public List<BookingRequest> GetBookings()
        {
            return _bookings.ToList();
        }

        public decimal CalculateCost(double distance, ServiceType serviceType,bool isRound)
        {

            decimal baseRate = serviceType switch
            {
                ServiceType.Standard => 50m,
                ServiceType.Premium => 75m,
                ServiceType.Luxury => 100m,
                _ => 50m
            };
            if (isRound)
            {
                // Base rate + $5 per kilometer
                return baseRate + (decimal)(distance * 5)*2;
            }
            else
            {
                // Base rate + $5 per kilometer
                return baseRate + (decimal)(distance * 5);
            }
              
        }

        public double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371; // Earth's radius in kilometers
            var dLat = ToRadians(lat2 - lat1);
            var dLon = ToRadians(lon2 - lon1);

            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return R * c;
        }

        private static double ToRadians(double degrees) => degrees * Math.PI / 180;
    }
}
