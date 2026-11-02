import 'package:flutter_test/flutter_test.dart';
import 'package:nopa_app/core/station_categories.dart';

void main() {
  group('StationCategories.parse', () {
    test('keeps every category, in admin order, under its own title', () {
      final cats = StationCategories.parse([
        {'id': 'b', 'title': 'کلاس‌های رسانه‌ای', 'orderIndex': 2, 'sessions': []},
        {'id': 'c', 'title': 'کلاس‌های هنری', 'orderIndex': 3, 'sessions': []},
        {'id': 'a', 'title': 'کلاس‌های شناختی', 'orderIndex': 1, 'sessions': []},
      ]);
      expect(cats.map((c) => c.id), ['a', 'b', 'c']);
      expect(cats.map((c) => c.shortTitle), ['شناختی', 'رسانه‌ای', 'هنری']);
      expect(cats.map((c) => c.index), [0, 1, 2]);
    });

    test('a renamed category is not reclassified by keywords in its title', () {
      final cats = StationCategories.parse([
        {'id': 'x', 'title': 'شناختی', 'orderIndex': 1, 'sessions': []},
        {'id': 'y', 'title': 'مهارتی', 'orderIndex': 2, 'sessions': []},
      ]);
      expect(cats.first.id, 'x');
      expect(cats.first.classLabel, 'کلاس شناختی');
      expect(cats.last.shortTitle, 'مهارتی');
    });

    test('equal orderIndex keeps the server order and deleted sessions are dropped', () {
      final cats = StationCategories.parse([
        {
          'id': 'first',
          'title': 'الف',
          'orderIndex': 0,
          'sessions': [
            {'id': 's1', 'isDeleted': false, 'videoClips': [{'id': 'c1'}]},
            {'id': 's2', 'isDeleted': true},
          ],
        },
        {'id': 'second', 'title': 'ب', 'orderIndex': 0, 'sessions': []},
      ]);
      expect(cats.map((c) => c.id), ['first', 'second']);
      expect(cats.first.sessions.map((s) => s['id']), ['s1']);
      expect((cats.first.sessions.first['videoClips'] as List).length, 1);
    });
  });

  test('track types stay compatible with stored progress', () {
    expect(StationCategories.trackTypeFor(0), 'skill');
    expect(StationCategories.trackTypeFor(1), 'media');
    expect(StationCategories.trackTypeFor(2), 'category_3');
    expect(StationCategories.indexForTrackType('mediaClass'), 1);
    expect(StationCategories.indexForTrackType('category_3'), 2);
  });
}
