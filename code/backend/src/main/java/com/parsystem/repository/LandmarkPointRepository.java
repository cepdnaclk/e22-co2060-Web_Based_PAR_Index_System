package com.parsystem.repository;

import com.parsystem.entity.LandmarkPoint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LandmarkPointRepository extends JpaRepository<LandmarkPoint, Long> {

    /** All landmarks for a given case, ordered by slot then name. */
    List<LandmarkPoint> findByOrthoCaseIdOrderBySlotAscPointNameAsc(Long caseId);

    /** All landmarks for a specific slot within a case. */
    List<LandmarkPoint> findByOrthoCaseIdAndSlot(Long caseId, LandmarkPoint.Slot slot);

    /** Delete all landmarks for a case (used before re-placing points). */
    void deleteByOrthoCaseId(Long caseId);

    /** Delete landmarks for one slot only. */
    void deleteByOrthoCaseIdAndSlot(Long caseId, LandmarkPoint.Slot slot);

    /** Count how many landmarks have been placed for a case. */
    long countByOrthoCaseId(Long caseId);
}
