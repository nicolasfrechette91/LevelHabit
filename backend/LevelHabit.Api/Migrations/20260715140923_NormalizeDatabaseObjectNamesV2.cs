using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LevelHabit.Api.Migrations;

/// <inheritdoc />
public partial class NormalizeDatabaseObjectNamesV2 : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        /*
         * Normalize all table constraint names in the public schema.
         *
         * This includes:
         * - Primary keys
         * - Foreign keys
         * - Unique constraints
         * - Check constraints
         */
        migrationBuilder.Sql(
            """
            DO $$
            DECLARE
                current_constraint record;
                normalized_name text;
            BEGIN
                FOR current_constraint IN
                    SELECT
                        constraint_object.oid AS constraint_oid,
                        constraint_object.conrelid AS table_oid,
                        constraint_object.conname AS constraint_name,
                        schema_object.nspname AS schema_name,
                        table_object.relname AS table_name
                    FROM pg_constraint AS constraint_object
                    INNER JOIN pg_class AS table_object
                        ON table_object.oid = constraint_object.conrelid
                    INNER JOIN pg_namespace AS schema_object
                        ON schema_object.oid = table_object.relnamespace
                    WHERE schema_object.nspname = 'public'
                      AND constraint_object.conrelid <> 0
                      AND constraint_object.conname <>
                          lower(constraint_object.conname)
                    ORDER BY
                        table_object.relname,
                        constraint_object.conname
                LOOP
                    normalized_name :=
                        lower(current_constraint.constraint_name);

                    IF EXISTS
                    (
                        SELECT 1
                        FROM pg_constraint AS existing_constraint
                        WHERE existing_constraint.conrelid =
                              current_constraint.table_oid
                          AND existing_constraint.conname =
                              normalized_name
                          AND existing_constraint.oid <>
                              current_constraint.constraint_oid
                    )
                    THEN
                        RAISE EXCEPTION
                            'Cannot rename constraint %.% to "%": target name already exists.',
                            current_constraint.table_name,
                            current_constraint.constraint_name,
                            normalized_name;
                    END IF;

                    EXECUTE format(
                        'ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I',
                        current_constraint.schema_name,
                        current_constraint.table_name,
                        current_constraint.constraint_name,
                        normalized_name);
                END LOOP;
            END
            $$;
            """);

        /*
         * Normalize standalone indexes.
         *
         * Primary-key and unique-constraint indexes are excluded because
         * PostgreSQL renames their backing indexes with the constraints.
         */
        migrationBuilder.Sql(
            """
            DO $$
            DECLARE
                current_index record;
                normalized_name text;
            BEGIN
                FOR current_index IN
                    SELECT
                        index_object.oid AS index_oid,
                        index_object.relnamespace AS schema_oid,
                        index_object.relname AS index_name,
                        schema_object.nspname AS schema_name,
                        table_object.relname AS table_name
                    FROM pg_class AS index_object
                    INNER JOIN pg_namespace AS schema_object
                        ON schema_object.oid =
                           index_object.relnamespace
                    INNER JOIN pg_index AS index_definition
                        ON index_definition.indexrelid =
                           index_object.oid
                    INNER JOIN pg_class AS table_object
                        ON table_object.oid =
                           index_definition.indrelid
                    WHERE schema_object.nspname = 'public'
                      AND index_object.relkind IN ('i', 'I')
                      AND index_object.relname <>
                          lower(index_object.relname)
                      AND NOT EXISTS
                      (
                          SELECT 1
                          FROM pg_constraint AS constraint_object
                          WHERE constraint_object.conindid =
                                index_object.oid
                      )
                    ORDER BY
                        table_object.relname,
                        index_object.relname
                LOOP
                    normalized_name :=
                        lower(current_index.index_name);

                    IF EXISTS
                    (
                        SELECT 1
                        FROM pg_class AS existing_index
                        WHERE existing_index.relnamespace =
                              current_index.schema_oid
                          AND existing_index.relname =
                              normalized_name
                          AND existing_index.oid <>
                              current_index.index_oid
                    )
                    THEN
                        RAISE EXCEPTION
                            'Cannot rename index %.% to "%": target name already exists.',
                            current_index.schema_name,
                            current_index.index_name,
                            normalized_name;
                    END IF;

                    EXECUTE format(
                        'ALTER INDEX %I.%I RENAME TO %I',
                        current_index.schema_name,
                        current_index.index_name,
                        normalized_name);
                END LOOP;
            END
            $$;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        throw new NotSupportedException(
            "The previous capitalization was inconsistent between databases, " +
            "so it cannot be restored reliably.");
    }
}