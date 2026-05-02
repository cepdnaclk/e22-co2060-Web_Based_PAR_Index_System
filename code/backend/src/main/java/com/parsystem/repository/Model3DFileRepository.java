package com.parsystem.repository;

import com.parsystem.entity.Model3DFile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface Model3DFileRepository extends JpaRepository<Model3DFile, Long> {
    List<Model3DFile> findByOrthoCaseId(Long caseId);
    List<Model3DFile> findByTrainingSetId(Long trainingSetId);
}