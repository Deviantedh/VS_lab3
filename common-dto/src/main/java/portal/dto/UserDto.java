package portal.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;


import java.time.Instant;

public class UserDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(name = "UserRequest")
    public static class Request {
        @Schema(description = "ID привязанного сотрудника (опционально)", example = "1")
        private Long employeeId;

        @NotNull(message = "ID роли обязателен (0 - ADMIN, 1 - HR, 2 - MANAGER, 3 - EMPLOYEE)")
        @Schema(description = "ID роли: 0 - ADMIN, 1 - HR, 2 - MANAGER, 3 - EMPLOYEE", example = "3")
        private Short roleId;

        @NotBlank(message = "Логин обязателен")
        @Size(min = 3, max = 100, message = "Логин должен быть от 3 до 100 символов")
        @Schema(description = "Логин пользователя", example = "ivanov")
        private String login;

        @Size(min = 4, max = 100, message = "Пароль должен быть от 4 до 100 символов")
        @Schema(description = "Пароль пользователя (хэшируется при сохранении, никогда не возвращается в ответах)", example = "1234")
        private String password;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(name = "UserResponse")
    public static class Response {
        @Schema(description = "ID пользователя", example = "1")
        private Long id;
        @Schema(description = "ID сотрудника", example = "1")
        private Long employeeId;
        @Schema(description = "ФИО сотрудника", example = "Ваш текст")
        private String employeeName;
        @Schema(description = "ID роли", example = "3")
        private Short roleId;
        @Schema(description = "Код роли", example = "EMPLOYEE")
        private RoleCode roleCode;
        @Schema(description = "Название роли", example = "Ваш текст")
        private String roleName;
        @Schema(description = "Логин", example = "Ваш текст")
        private String login;
        @Schema(description = "Активен ли пользователь", example = "true")
        private Boolean isActive;
        private Instant lastLoginAt;
        private Instant createdAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(name = "RoleResponse")
    public static class RoleResponse {
        @Schema(description = "ID роли: 0 - ADMIN, 1 - HR, 2 - MANAGER, 3 - EMPLOYEE", example = "0")
        private Short id;
        @Schema(description = "Код роли", example = "ADMIN")
        private RoleCode code;
        @Schema(description = "Название роли", example = "Администратор")
        private String name;
        @Schema(description = "Описание роли", example = "Полный доступ к управлению системой")
        private String description;
    }
}
