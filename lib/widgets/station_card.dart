import 'package:flutter/material.dart';
import '../models/station.dart';

class StationCard extends StatelessWidget {
  final Station station;
  final VoidCallback onTap;

  const StationCard({
    super.key,
    required this.station,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // Custom colors based on station state
    Color borderColor = const Color(0xFF2C224D); // Default dark purple border
    Color cardBgColor = const Color(0xFF1E1435);
    bool isCompleted = station.progress >= 1.0 && !station.isLocked;

    if (station.isLocked) {
      borderColor = Colors.grey.withValues(alpha: 0.2);
    } else if (station.isCurrent) {
      borderColor = const Color(0xFF10B981); // Emerald green for current station
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 220,
        margin: const EdgeInsets.only(left: 16),
        decoration: BoxDecoration(
          color: cardBgColor,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: borderColor,
            width: station.isCurrent ? 2.5 : 1.5,
          ),
          boxShadow: station.isCurrent
              ? [
                  BoxShadow(
                    color: const Color(0xFF10B981).withValues(alpha: 0.15),
                    blurRadius: 12,
                    spreadRadius: 2,
                  )
                ]
              : null,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Image Section
              Expanded(
                flex: 5,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.network(
                      station.imageUrl,
                      fit: BoxFit.cover,
                      color: station.isLocked ? Colors.black54 : null,
                      colorBlendMode: station.isLocked ? BlendMode.saturation : null,
                      errorBuilder: (context, error, stackTrace) {
                        return Container(
                          color: Colors.white10,
                          child: const Icon(Icons.broken_image, color: Colors.white30, size: 40),
                        );
                      },
                    ),
                    // Gradient overlay on image
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.7),
                          ],
                        ),
                      ),
                    ),
                    
                    // State Badges
                    if (station.isCurrent)
                      Positioned(
                        bottom: 12,
                        right: 12,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withValues(alpha: 0.9),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'منزل فعلی',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      )
                    else if (isCompleted)
                      Positioned(
                        bottom: 12,
                        right: 12,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.green.withValues(alpha: 0.5)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              Text(
                                'تکمیل شده',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              SizedBox(width: 4),
                              Icon(Icons.check_box, color: Colors.green, size: 14),
                            ],
                          ),
                        ),
                      )
                    else if (station.isLocked)
                      const Center(
                        child: Icon(Icons.lock, color: Colors.white60, size: 36),
                      ),
                  ],
                ),
              ),
              
              // Text Content Section
              Expanded(
                flex: 4,
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        station.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: station.isLocked ? Colors.white38 : Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            station.classesCount,
                            style: TextStyle(
                              color: station.isLocked ? Colors.white24 : Colors.white60,
                              fontSize: 12,
                            ),
                          ),
                          if (!station.isLocked && !isCompleted)
                            SizedBox(
                              width: 60,
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: station.progress,
                                  backgroundColor: Colors.white10,
                                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFFFD54F)),
                                  minHeight: 5,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
