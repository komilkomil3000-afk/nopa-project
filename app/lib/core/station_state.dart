/// One rule for a station's state, shared by the home carousel, the academy roadmap and the station page, so the
/// lock icon, the label and the content never disagree.
///
/// `levelFrame` is the user's 1-based level and `completedStationsCount` how many stations are finished.
/// The furthest station the user has reached (0-based) is `max(levelFrame - 1, completedStationsCount)`:
/// everything before it is completed, it is the current one, everything after it is locked. A station the server
/// locks (release time or manual lock) is locked whatever the progress.
class StationState {
  final bool isLocked;
  final bool isCompleted;
  final bool isCurrent;

  const StationState({required this.isLocked, required this.isCompleted, required this.isCurrent});

  static StationState resolve({
    required int index,
    required int levelFrame,
    required int completedStationsCount,
    bool serverLocked = false,
  }) {
    final int level = levelFrame < 1 ? 1 : levelFrame;
    final int reached = (level - 1) > completedStationsCount ? (level - 1) : completedStationsCount;
    final bool locked = serverLocked || index > reached;
    return StationState(
      isLocked: locked,
      isCompleted: !locked && index < reached,
      isCurrent: !locked && index == reached,
    );
  }
}
