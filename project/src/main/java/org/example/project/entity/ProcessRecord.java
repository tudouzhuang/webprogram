package org.example.project.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import lombok.Data;
import java.time.LocalDateTime;

@Data // Lombok annotation to automatically generate getters, setters, toString, equals, and hashCode methods.
@TableName("process_records") // MyBatis-Plus annotation to map the class to the "process_records" table in the database.
public class ProcessRecord {

    @TableId(type = IdType.AUTO) // This annotation is used to indicate that the "id" field is the primary key and auto-incremented.
    private Long id;  // The primary key of the table.

    private Long projectId;  // ID of the project this process record belongs to.

    private String partName;  // The name of the part associated with this process.

    private String processName;  // The name of the process.

    private Long createdByUserId;  // The ID of the user who created this record.

    private LocalDateTime createdAt;  // The timestamp when the record was created.

    // This is used to store JSON data in the database, which will be handled by MyBatis-Plus's JsonTypeHandler.
    private String specificationsJson; 
    private String sourceFilePath; // 对应数据库的 source_file_path 列
    private String status;  // The status of the process record (e.g., "Pending", "Completed").

    private Long assigneeId;  // ID of the user assigned to this process.
    
}


