# Production image for the CODE76 server. Railway, Render or any Docker host can build it.
# Stage 1 builds the app with Maven; stage 2 runs it on a small Java 21 runtime.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY mvnw pom.xml ./
COPY .mvn .mvn
# mvnw may have Windows line endings when committed from Windows.
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY src src
# Tests need Docker (Testcontainers), so they run on your computer, not during the image build.
RUN ./mvnw -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 app
COPY --from=build /app/target/*.jar app.jar
USER app
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
