package com.parsystem.entity;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Tests the British PAR weighting formula in PARScore.computeWeighted():
 *   upperAnterior x1, lowerAnterior x1, buccalLeft x1, buccalRight x1,
 *   overjet x6, overbite x2, centreline x4
 */
class PARScoreTest {

    @Test
    void allZeroComponentsGiveZeroTotal() {
        PARScore score = PARScore.builder()
                .upperAnterior(0).lowerAnterior(0)
                .buccalLeft(0).buccalRight(0)
                .overjet(0).overbite(0).centreline(0)
                .build();

        assertEquals(0, score.computeWeighted());
    }

    @Test
    void appliesBritishStandardWeightsCorrectly() {
        PARScore score = PARScore.builder()
                .upperAnterior(2)   // x1 = 2
                .lowerAnterior(3)   // x1 = 3
                .buccalLeft(1)      // x1 = 1
                .buccalRight(4)     // x1 = 4
                .overjet(2)         // x6 = 12
                .overbite(3)        // x2 = 6
                .centreline(1)      // x4 = 4
                .build();

        // 2 + 3 + 1 + 4 + 12 + 6 + 4 = 32
        assertEquals(32, score.computeWeighted());
    }

    @Test
    void overjetHasTheHighestWeightOfAnySingleComponent() {
        PARScore withOverjet = PARScore.builder().overjet(1).build();
        PARScore withUpperAnterior = PARScore.builder().upperAnterior(1).build();

        // A single point of overjet should count for more than a single
        // point of any x1-weighted component, since overjet carries the
        // heaviest clinical weighting (x6) in the British PAR index.
        assertEquals(6, withOverjet.computeWeighted());
        assertEquals(1, withUpperAnterior.computeWeighted());
    }

    @Test
    void atMaximumComponentValuesTotalMatchesExpectedMaximum() {
        // Max values per the @Max annotations on each field.
        PARScore score = PARScore.builder()
                .upperAnterior(10)
                .lowerAnterior(10)
                .buccalLeft(7)
                .buccalRight(7)
                .overjet(5)
                .overbite(4)
                .centreline(2)
                .build();

        // 10 + 10 + 7 + 7 + (5*6=30) + (4*2=8) + (2*4=8) = 80
        assertEquals(80, score.computeWeighted());
    }
}
