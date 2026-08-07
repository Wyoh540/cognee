from cognee.api.v1.datasets.routers.get_datasets_router import (
    DatasetDatabaseConfigUpdateDTO,
    _stringify_database_port,
)


def test_dataset_database_config_accepts_numeric_ports_as_strings():
    payload = DatasetDatabaseConfigUpdateDTO(
        graph_database_port=5432,
        vector_database_port=6333,
    )

    assert payload.graph_database_port == "5432"
    assert payload.vector_database_port == "6333"


def test_dataset_database_config_keeps_string_ports():
    payload = DatasetDatabaseConfigUpdateDTO(graph_database_port="7687")

    assert payload.graph_database_port == "7687"


def test_dataset_database_config_response_stringifies_persisted_ports():
    assert _stringify_database_port(5432) == "5432"
    assert _stringify_database_port("6333") == "6333"
    assert _stringify_database_port(None) == ""
