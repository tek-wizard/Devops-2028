# ------------------------------------------------------------------
# Stage 1: compile the Java source into a class file.
# This needs the full JDK because javac lives in the JDK.
# ------------------------------------------------------------------
FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

COPY Main.java .
RUN javac Main.java

# ------------------------------------------------------------------
# Stage 2: run it.
# Only the compiled Main.class is copied across, and the JRE image is
# used instead of the JDK because running does not need the compiler.
# ------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=build /app/Main.class .

EXPOSE 8080

CMD ["java", "Main"]
