"""Index precision, annual identity, referential integrity and query contracts."""
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from ch4_marginality.pixel_identity import (
    HEIGHT, WIDTH, create_schema, lookup, pixel_coordinates, pixel_id,
)


class PixelIdentityContracts(unittest.TestCase):
    def test_roundtrip_and_float32_precision_boundary(self):
        for identity in [1,WIDTH,WIDTH+1,2**24,2**24+1,HEIGHT*WIDTH]:
            row,column=pixel_coordinates(identity)
            self.assertEqual(pixel_id(row,column),identity)
        self.assertEqual(pixel_coordinates(HEIGHT*WIDTH),(HEIGHT-1,WIDTH-1))
        self.assertNotEqual(pixel_id(0,WIDTH-1),pixel_id(1,0))

    def test_invalid_and_nodata_ids_are_rejected(self):
        for identity in [0,-1,HEIGHT*WIDTH+1,1.5,True]:
            with self.assertRaises(ValueError):pixel_coordinates(identity)
        for row,column in [(-1,0),(HEIGHT,0),(0,WIDTH),(0,1.5),(True,0)]:
            with self.assertRaises(ValueError):pixel_id(row,column)

    def test_uniqueness_foreign_keys_and_annual_namespace(self):
        with sqlite3.connect(":memory:") as db:
            create_schema(db)
            for year in [2019,2021]:
                db.execute("INSERT INTO patches VALUES (?,?,?,?,?,?)",
                           (year,1,f"CH4G5070V1:Y{year}:C1","PATCH_same",f"PATCH_same_{year}",1))
                db.execute("INSERT INTO crop_pixels VALUES (?,?,?)",(year,2**24+1,1))
            records=db.execute("SELECT pixel_key,pixel_year_key,patch_key FROM crop_pixel_lookup ORDER BY year").fetchall()
            self.assertEqual(records[0][0],records[1][0])
            self.assertNotEqual(records[0][1],records[1][1])
            self.assertNotEqual(records[0][2],records[1][2])
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("INSERT INTO crop_pixels VALUES (2019,16777217,1)")
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("INSERT INTO crop_pixels VALUES (2017,1,1)")
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("INSERT INTO crop_pixels VALUES (2019,0,1)")

    def test_indexed_lookup_distinguishes_nonmembership_and_retains_missing_yield_pixels(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"pixels.sqlite"
            with closing(sqlite3.connect(path)) as db, db:
                create_schema(db)
                db.execute("INSERT INTO patches VALUES (2019,1,'CH4G5070V1:Y2019:C1','PATCH_x','PATCH_x_2019',1)")
                # Membership is independent of yield observations; there is no yield-valid gate.
                db.execute("INSERT INTO crop_pixels VALUES (2019,1,1)")
                plan=db.execute("EXPLAIN QUERY PLAN SELECT * FROM crop_pixel_lookup WHERE year=2019 AND pixel_id=1").fetchall()
                self.assertTrue(any("PRIMARY KEY" in row[-1] for row in plan))
            record=lookup(path,2019,1)
            self.assertEqual(record["pixel_key"],"CH4G5070V1:P1")
            self.assertEqual(record["center_easting_m"],-111270)
            self.assertEqual(record["center_northing_m"],2047260)
            self.assertIsNone(lookup(path,2019,2))
            self.assertIsNone(lookup(path,2021,1))


if __name__=="__main__":unittest.main()
