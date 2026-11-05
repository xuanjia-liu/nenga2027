# Builds the 「羊＋大＝美」 gacha machine and exports it as GLB.
# Coordinates: Blender is Z-up with the machine's front facing -Y; the glTF exporter converts to three.js Y-up (+Z = front).
import bpy, bmesh, math, sys
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/gacha.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1,)

def mat(name, hexc, metal=0., rough=.4, coat=0., coat_r=.08):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = hexrgb(hexc)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if coat:
        p.inputs['Coat Weight'].default_value = coat
        p.inputs['Coat Roughness'].default_value = coat_r
    return m

M = {
    'blue': mat('PaintBlue', '#0066FF', .15, .26, 1., .05),
    'navy': mat('Navy', '#16305C', .4, .34, .6, .1),
    'chrome': mat('Chrome', '#E9EEF7', 1., .13),
    'gold': mat('Gold', '#FFD43B', .9, .22),
    'white': mat('White', '#EEF3FB', 0., .3, .6, .08),
    'dark': mat('Dark', '#050B1A', 0., .9),
    'ivory': mat('Ivory', '#F4ECD8', 0., .45, .3, .2),
}

def finish(o, m, bevel=0., seg=3, smooth=True, name=None):
    if name: o.name = name
    o.data.materials.clear(); o.data.materials.append(m)
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = seg; b.limit_method = 'ANGLE'; b.harden_normals = False
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
        try:
            wn = o.modifiers.new('wn', 'WEIGHTED_NORMAL'); wn.keep_sharp = True
        except Exception: pass
    return o

def box(name, size, loc, m, bevel=0., seg=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, m, bevel, seg, name=name)

def cyl(name, r, h, loc, m, verts=48, bevel=0., seg=3, rot=None, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r2, radius2=r, depth=h, location=loc)
    o = bpy.context.active_object
    if rot: o.rotation_euler = rot; bpy.ops.object.transform_apply(rotation=True)
    return finish(o, m, bevel, seg, name=name)

def torus(name, R, r, loc, m, rot=None, maj=56, mn=12):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=maj, minor_segments=mn, location=loc)
    o = bpy.context.active_object
    if rot: o.rotation_euler = rot; bpy.ops.object.transform_apply(rotation=True)
    return finish(o, m, name=name)

def sphere(name, r, loc, m, seg=32, ring=16, half=False):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=ring, location=loc)
    o = bpy.context.active_object
    if half:
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS'); bm.to_mesh(o.data); bm.free()
    return finish(o, m, name=name)

GY, FRONT = 2.82, -.75
# ---- base plinth with a chrome trim and little feet
box('Base', (2.4, 1.7, .14), (0, 0, .07), M['navy'], .055, 4)
box('BaseTrim', (2.3, 1.6, .03), (0, 0, .155), M['chrome'], .012, 2)
# ---- main body (rounded, glossy brand blue)
box('Body', (2.1, 1.5, 1.7), (0, 0, .99), M['blue'], .23, 6)
# chrome bands wrapping the body near the top and bottom
for z in (.3, 1.70):
    box('Band', (2.14, 1.54, .045), (0, 0, z), M['chrome'], .2, 5)
# side medallions: a white disc with a gold ring on each side
for sx in (-1, 1):
    cyl('SideDisc', .3, .04, (sx * 1.055, 0, 1.0), M['white'], 48, .015, 2, rot=(0, math.pi / 2, 0))
    torus('SideRing', .3, .025, (sx * 1.075, 0, 1.0), M['gold'], rot=(0, math.pi / 2, 0))
    cyl('SideDot', .12, .03, (sx * 1.08, 0, 1.0), M['blue'], 32, .01, 2, rot=(0, math.pi / 2, 0))
# marquee frame around the label (the label itself is drawn in three.js at y=1.58)
fw, fh, fz = 1.82, .5, 1.58
for (sx, sz, x, z) in ((fw, .045, 0, fz + fh / 2), (fw, .045, 0, fz - fh / 2), (.045, fh, -fw / 2, fz), (.045, fh, fw / 2, fz)):
    box('Marquee', (sx, .05, sz), (x, FRONT - .01, z), M['gold'], .015, 2)
# coin plate + slot + return button
box('CoinPlate', (.36, .05, .44), (.55, FRONT - .015, 1.05), M['chrome'], .04, 3)
box('CoinSlot', (.07, .03, .24), (.55, FRONT - .035, 1.08), M['dark'], .01, 2)
cyl('CoinBtn', .045, .04, (.55, FRONT - .04, .89), M['gold'], 24, .01, 2, rot=(math.pi / 2, 0, 0))
# dispenser chute: dark opening with a chrome frame and a hood
box('ChuteHole', (.7, .03, .46), (.5, FRONT - .005, .5), M['dark'])
for (sx, sz, x, z) in ((.82, .06, .5, .76), (.06, .5, .12, .5), (.06, .5, .88, .5)):
    box('ChuteFrame', (sx, .07, sz), (x, FRONT - .02, z), M['chrome'], .02, 2)
bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=.42, depth=.8, location=(.5, FRONT - .02, .76))
hood = bpy.context.active_object; hood.rotation_euler = (0, math.pi / 2, 0); bpy.ops.object.transform_apply(rotation=True)
bm = bmesh.new(); bm.from_mesh(hood.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -.02 or v.co.y > .02], context='VERTS'); bm.to_mesh(hood.data); bm.free()
hood.scale = (1, .45, .36); bpy.ops.object.transform_apply(scale=True)
sol = hood.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = .03
finish(hood, M['blue'], name='ChuteHood')
# tray (a rounded tub) in front of the chute
bpy.ops.mesh.primitive_cube_add(size=1, location=(.5, -.95, .3)); tray = bpy.context.active_object
tray.scale = (.84, .5, .2); bpy.ops.object.transform_apply(scale=True)
bpy.ops.mesh.primitive_cube_add(size=1, location=(.5, -.95, .38)); cut = bpy.context.active_object
cut.scale = (.74, .4, .2); bpy.ops.object.transform_apply(scale=True)
bo = tray.modifiers.new('cut', 'BOOLEAN'); bo.object = cut; bo.operation = 'DIFFERENCE'
bpy.context.view_layer.objects.active = tray; bpy.ops.object.modifier_apply(modifier='cut')
bpy.data.objects.remove(cut)
finish(tray, M['white'], .025, 3, name='Tray')
box('TrayLip', (.86, .52, .02), (.5, -.95, .41), M['chrome'], .008, 2)
# ---- globe collar: navy drum, chrome ring, gold ring
cyl('Collar', 1.03, .26, (0, 0, 1.92), M['navy'], 64, .04, 3, r2=1.09)
torus('CollarChrome', 1.07, .03, (0, 0, 1.80), M['chrome'], maj=64)
torus('CollarGold', 1.03, .05, (0, 0, 2.05), M['gold'], maj=64)
# ---- top: gold dome, chrome finial, and curled ram horns (羊!)
sphere('Dome', .36, (0, 0, GY + .9), M['gold'], 40, 20, half=True)
cyl('DomeRim', .38, .05, (0, 0, GY + .9), M['gold'], 48, .015, 2)
cyl('Neck', .06, .14, (0, 0, GY + 1.3), M['chrome'], 20)
sphere('Finial', .1, (0, 0, GY + 1.42), M['chrome'], 24, 12)

def horn(side):
    cu = bpy.data.curves.new('horn', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = .085; cu.bevel_resolution = 4; cu.resolution_u = 4
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); N = 40
    cx, cz = side * .44, GY + 1.27
    pts = []
    for i in range(N):
        t = i / (N - 1)
        a = math.pi * .62 - t * math.pi * 1.85          # start at the dome top, sweep outward and curl under
        r = .26 * (1 - .62 * t)
        x = cx + side * (-math.cos(a)) * r * -1
        z = cz - math.sin(a) * r                         # root at the dome, coil rising above it
        y = -.06 * t                                      # curl slightly toward the front
        pts.append((x, y, z, 1 - .7 * t))
    sp.points.add(N - 1)
    for p, (x, y, z, w) in zip(sp.points, pts): p.co = (x, y, z, 1); p.radius = w
    o = bpy.data.objects.new('Horn', cu); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object
    finish(o, M['ivory'], name='Horn')
    # grooves: a ring of thin tori along the horn
    return o
for s in (-1, 1): horn(s)

# ---- knob (separate object with its origin at the hub so three.js can spin it)
KX, KY, KZ = -.42, FRONT - .01, .82
parts = []
parts.append(cyl('KnobDisc', .36, .1, (KX, KY - .05, KZ), M['white'], 48, .02, 2, rot=(math.pi / 2, 0, 0)))
parts.append(torus('KnobRing', .36, .03, (KX, KY - .1, KZ), M['chrome'], rot=(math.pi / 2, 0, 0)))
parts.append(box('KnobBar', (.62, .13, .14), (KX, KY - .17, KZ), M['gold'], .05, 4))
parts.append(cyl('KnobHub', .085, .1, (KX, KY - .26, KZ), M['navy'], 24, .02, 2, rot=(math.pi / 2, 0, 0)))
for o in parts:
    bpy.context.view_layer.objects.active = o
    for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
knob = bpy.context.active_object; knob.name = 'Knob'
bpy.context.scene.cursor.location = (KX, KY, KZ); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

# apply modifiers on everything, then join the static parts per material to keep the draw count low
for o in list(bpy.data.objects):
    if o.type != 'MESH' or o.name == 'Knob': continue
    bpy.context.view_layer.objects.active = o
    for mod in list(o.modifiers):
        try: bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e: print('mod fail', o.name, e)
groups = {}
for o in list(bpy.data.objects):
    if o.type != 'MESH' or o.name == 'Knob': continue
    groups.setdefault(o.data.materials[0].name, []).append(o)
for mname, objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join()
    bpy.context.active_object.name = 'Machine_' + mname
    bpy.context.scene.cursor.location = (0, 0, 0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

tris = 0
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles); print(o.name, len(o.data.loop_triangles))
print('TRIS', tris)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True, export_materials='EXPORT', export_normals=True, export_texcoords=False, export_vertex_color='NONE')
print('EXPORTED', OUT)
