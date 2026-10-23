package portal.schedule.controller;
import portal.dto.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import portal.dto.ShiftDto;
import portal.dto.ShiftEmployeeLogDto;
import portal.schedule.service.ReactiveScheduleBridgeService;
import portal.schedule.service.ShiftService;
import reactor.core.publisher.Mono;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/shifts")
@RequiredArgsConstructor
@Tag(name = "Shifts", description = "Управление сменами, назначениями персонала и аудит-логом")
public class ShiftController {

    private final ShiftService shiftService;
    private final ReactiveScheduleBridgeService bridgeService;
    private final portal.schedule.client.EmployeeClient employeeClient;
    private final portal.schedule.client.BranchClient branchClient;
    private final portal.schedule.client.AttendanceClient attendanceClient;

    @GetMapping("/circuit-breaker/employee/{id}")
    @Operation(summary = "Проверка Circuit Breaker: запрос профиля из employee-service")
    public ResponseEntity<portal.dto.EmployeeDto.Response> checkEmployeeCircuitBreaker(@PathVariable Long id) {
        return ResponseEntity.ok(employeeClient.getEmployeeById(id));
    }

    @GetMapping("/circuit-breaker/branch/{id}")
    @Operation(summary = "Проверка Circuit Breaker: запрос филиала из employee-service")
    public ResponseEntity<portal.dto.BranchDto.Response> checkBranchCircuitBreaker(@PathVariable Long id) {
        return ResponseEntity.ok(branchClient.getBranchById(id));
    }

    @GetMapping("/circuit-breaker/attendance/{id}")
    @Operation(summary = "Проверка Circuit Breaker: запрос явки из attendance-service")
    public ResponseEntity<portal.dto.AttendanceRecordDto.Response> checkAttendanceCircuitBreaker(@PathVariable Long id) {
        return ResponseEntity.ok(attendanceClient.getAttendanceById(id));
    }

    /**
     * ТРЕБОВАНИЕ ТЗ:
     * Должен быть минимум один запрос, который вернет findAll с пагинацией и с указанием общего количества записей в http хедере.
     */
    @GetMapping
    @Operation(
            summary = "Получить список смен с пагинацией и возвратом общего количества в HTTP-заголовке X-Total-Count",
            description = "Возвращает массив смен в теле ответа, а общее количество найденных записей — в HTTP-заголовке X-Total-Count.",
            responses = {
                    @ApiResponse(
                            responseCode = "200",
                            description = "Успешная выборка",
                            headers = {
                                    @Header(name = "X-Total-Count", description = "Общее число смен в БД", schema = @Schema(type = "integer")),
                                    @Header(name = "X-Total-Pages", description = "Общее число страниц", schema = @Schema(type = "integer"))
                            }
                    )
            }
    )
    public ResponseEntity<List<ShiftDto.Response>> getAll(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            @RequestParam(defaultValue = "date") String sortBy,
            @RequestParam(defaultValue = "DESC") Sort.Direction direction
    ) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(direction, sortBy));
        Page<ShiftDto.Response> pageResult = shiftService.getAllPaged(pageRequest);

        return ResponseEntity.ok()
                .header("X-Total-Count", String.valueOf(pageResult.getTotalElements()))
                .header("X-Total-Pages", String.valueOf(pageResult.getTotalPages()))
                .body(pageResult.getContent());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Получить смену по ID")
    public ResponseEntity<ShiftDto.Response> getById(@PathVariable Long id) {
        return ResponseEntity.ok(shiftService.getById(id));
    }

    @GetMapping("/schedule/{scheduleId}")
    @Operation(summary = "Получить смены конкретного графика")
    public ResponseEntity<List<ShiftDto.Response>> getBySchedule(
            @PathVariable Long scheduleId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(50) int size
    ) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "date", "timeFrom"));
        Page<ShiftDto.Response> pageResult = shiftService.getBySchedule(scheduleId, pageRequest);
        return ResponseEntity.ok()
                .header("X-Total-Count", String.valueOf(pageResult.getTotalElements()))
                .header("X-Total-Pages", String.valueOf(pageResult.getTotalPages()))
                .body(pageResult.getContent());
    }

    @PostMapping
    @Operation(summary = "Создать смену в расписании")
    public ResponseEntity<ShiftDto.Response> create(@Valid @RequestBody ShiftDto.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(shiftService.create(request));
    }

    /**
     * ТРАНЗАКЦИОННЫЙ ЭНДПОИНТ №1:
     * Назначение сотрудника на смену.
     */
    @PostMapping("/{id}/employees")
    @Operation(
            summary = "Назначить сотрудника на смену (Транзакционный сценарий №1)",
            description = "Выполняет транзакционную проверку отпусков сотрудника, отсутствие пересечений со сменами в других филиалах и сохраняет аудит-лог."
    )
    public ResponseEntity<ShiftDto.Response> assignEmployee(
            @PathVariable Long id,
            @Valid @RequestBody ShiftDto.AssignEmployeeRequest request
    ) {
        return ResponseEntity.ok(shiftService.assignEmployee(id, request.getEmployeeId(), request.getAssignedById()));
    }

    @DeleteMapping("/{id}/employees/{employeeId}")
    @Operation(summary = "Снять сотрудника со смены с фиксацией в аудит-логе")
    public ResponseEntity<ShiftDto.Response> removeEmployee(
            @PathVariable Long id,
            @PathVariable Long employeeId,
            @RequestParam(required = false) Long removedById
    ) {
        return ResponseEntity.ok(shiftService.removeEmployee(id, employeeId, removedById));
    }

    @GetMapping("/{id}/logs")
    @Operation(summary = "Получить журнал (аудит-лог) изменений состава смены")
    public ResponseEntity<List<ShiftEmployeeLogDto>> getLogs(@PathVariable Long id) {
        return ResponseEntity.ok(shiftService.getLogs(id));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Удалить смену")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        shiftService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Реактивный эндпоинт (Reactor): назначение сотрудника на смену.
     * Внутри выполняется межсервисный вызов employee-service через Feign Client,
     * обёрнутый в Circuit Breaker (resilience4j) с fallback-заглушкой.
     * Используется для проверки отказоустойчивости: при недоступности
     * employee-service возвращается fallback-ответ без зависания шлюза.
     */
    @PostMapping("/reactive/{id}/employees/{employeeId}")
    @Operation(summary = "Назначить сотрудника на смену (реактивно, через Feign + Circuit Breaker)")
    public Mono<ShiftDto.Response> assignEmployeeReactive(@PathVariable Long id,
                                                          @PathVariable Long employeeId) {
        return bridgeService.assignEmployeeToShiftReactive(id, employeeId);
    }
}
