/// The number shown for a station is the rank set in the admin panel (orderIndex), so a station 0 is
/// displayed as "0". A user's `levelFrame` stays a 1-based position in the ordered station list; this
/// maps that position (or a list index + 1) to the station number to display.
class StationNumbering {
  static List<int> _orders = const [];

  /// Called with the stations returned by the server (ordered as the server returns them).
  static void update(List<Map<String, dynamic>> stations) {
    final orders = stations.map((s) => (s['orderIndex'] as num?)?.toInt()).whereType<int>().toList()..sort();
    if (orders.isNotEmpty) _orders = orders;
  }

  /// 0-based list index of a station number (before the list is loaded it assumes the numbers start at 1).
  static int indexOfNumber(int number) {
    final i = _orders.indexOf(number);
    if (i >= 0) return i;
    final first = _orders.isNotEmpty ? _orders.first : 1;
    return (number - first).clamp(0, 1 << 20);
  }

  /// Station number at a 1-based [position] in the ordered list (before the list is loaded: 1, 2, 3 ...).
  static int numberAt(int position) {
    if (position >= 1 && position <= _orders.length) return _orders[position - 1];
    final first = _orders.isNotEmpty ? _orders.first : 1;
    return first + (position < 1 ? 0 : position - 1);
  }
}
