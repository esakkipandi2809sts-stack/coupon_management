using System.Security.Cryptography;

namespace FlightBookingBackend.Services
{
    public static class CouponCodeGenerator
    {
        private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        public const int CodeLength = 8;

        public static string Generate()
        {
            return string.Create(CodeLength, 0, static (characters, _) =>
            {
                for (var index = 0; index < characters.Length; index++)
                {
                    characters[index] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
                }
            });
        }
    }
}
