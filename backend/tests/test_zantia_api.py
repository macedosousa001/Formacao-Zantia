"""Zantia Formação API tests: gavetoes + gavetinhas CRUD/read, no _id leakage."""
import os
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://renewable-skills-hub.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

EXPECTED_COUNTS = {"g1": 11, "g2": 7, "g3": 3, "g4": 9, "g5": 1}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- gavetoes ----------
class TestGavetoes:
    def test_list_gavetoes_returns_5_with_correct_counts(self, client):
        r = client.get(f"{API}/gavetoes", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 5
        by_id = {g["id"]: g for g in data}
        for gid, count in EXPECTED_COUNTS.items():
            assert gid in by_id, f"missing {gid}"
            assert len(by_id[gid]["gavetinhas"]) == count, f"{gid} expected {count}, got {len(by_id[gid]['gavetinhas'])}"
            # No _id leakage on gavetão
            assert "_id" not in by_id[gid]
            # No _id in nested gavetinhas
            for child in by_id[gid]["gavetinhas"]:
                assert "_id" not in child
                assert "id" in child and "title" in child

    def test_get_single_gavetao_g1(self, client):
        r = client.get(f"{API}/gavetoes/g1", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "g1"
        assert d["title"] == "Fotovoltaico"
        assert len(d["gavetinhas"]) == 11
        assert "_id" not in d

    def test_get_single_gavetao_404(self, client):
        r = client.get(f"{API}/gavetoes/nonexistent", timeout=30)
        assert r.status_code == 404


# ---------- gavetinhas ----------
class TestGavetinhas:
    @pytest.fixture(scope="class")
    def sample_gavetinha_id(self, client):
        r = client.get(f"{API}/gavetoes/g1", timeout=30)
        assert r.status_code == 200
        return r.json()["gavetinhas"][0]["id"]

    def test_get_gavetinha(self, client, sample_gavetinha_id):
        r = client.get(f"{API}/gavetinhas/{sample_gavetinha_id}", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == sample_gavetinha_id
        assert "_id" not in d
        assert "title" in d
        assert "images" in d and isinstance(d["images"], list)
        assert "videos" in d and isinstance(d["videos"], list)

    def test_get_gavetinha_404(self, client):
        r = client.get(f"{API}/gavetinhas/does-not-exist", timeout=30)
        assert r.status_code == 404

    def test_update_gavetinha_persists(self, client, sample_gavetinha_id):
        new_desc = "TEST_Descrição atualizada para testes automatizados."
        new_video = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        new_image_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX///+nxBvIAAAACklEQVR4nGNgAAAAAgABc3UBGAAAAABJRU5ErkJggg=="

        payload = {
            "description": new_desc,
            "videos": [new_video],
            "images": [new_image_b64],
        }
        r = client.put(f"{API}/gavetinhas/{sample_gavetinha_id}", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["description"] == new_desc
        assert updated["videos"] == [new_video]
        assert updated["images"] == [new_image_b64]
        assert "_id" not in updated

        # Verify persistence via GET
        r2 = client.get(f"{API}/gavetinhas/{sample_gavetinha_id}", timeout=30)
        assert r2.status_code == 200
        d = r2.json()
        assert d["description"] == new_desc
        assert d["videos"] == [new_video]
        assert d["images"] == [new_image_b64]

        # Cleanup: reset to empty arrays and generic desc
        client.put(
            f"{API}/gavetinhas/{sample_gavetinha_id}",
            json={"description": "Informação sobre item. Edite este conteúdo no modo administração.", "videos": [], "images": []},
            timeout=30,
        )

    def test_update_title_only(self, client, sample_gavetinha_id):
        # preserve original
        original = client.get(f"{API}/gavetinhas/{sample_gavetinha_id}", timeout=30).json()
        r = client.put(f"{API}/gavetinhas/{sample_gavetinha_id}", json={"title": "TEST_TitleChange"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_TitleChange"
        # restore
        client.put(f"{API}/gavetinhas/{sample_gavetinha_id}", json={"title": original["title"]}, timeout=30)

    def test_update_404(self, client):
        r = client.put(f"{API}/gavetinhas/nope", json={"title": "x"}, timeout=30)
        assert r.status_code == 404
