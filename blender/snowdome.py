# Snow-dome props: turned lacquer base, fluffy sheep rig (legs pivot at the hip), cottage, snowy pine, gift.
# Blender Z-up; exported Y-up (three.js: x=x, y=z, z=-y). Each prop is its own root object at the origin.
import bpy, bmesh, math, sys, random
from mathutils import Vector
OUT = sys.argv[sys.argv.index('--') + 1]
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)

def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1,)
def mat(name, hexc, metal=0., rough=.5, coat=0., emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = hexrgb(hexc); p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    if coat: p.inputs['Coat Weight'].default_value = coat; p.inputs['Coat Roughness'].default_value = .06
    if emit: p.inputs['Emission Color'].default_value = hexrgb(emit); p.inputs['Emission Strength'].default_value = 1.0
    return m
M = dict(lacq=mat('Lacquer', '#16305C', .2, .28, 1.), gold=mat('Gold', '#FFD43B', .9, .24), wool=mat('Wool', '#FFFFFF', 0, .95),
         ink=mat('Ink', '#161717', 0, .55), eye=mat('Eye', '#FFFFFF', 0, .3), wall=mat('Wall', '#F3F8FF', 0, .7), roof=mat('Roof', '#0066FF', 0, .5),
         snow=mat('Snow', '#FFFFFF', 0, .9), navy=mat('NavyWood', '#253A58', 0, .7), win=mat('Window', '#FFE94A', 0, .4, emit='#FFC94A'),
         pine=mat('Pine', '#1D3A63', 0, .8), bark=mat('Bark', '#3A2A1E', 0, .8), gblue=mat('GiftBlue', '#0066FF', 0, .4, .5), ribbon=mat('Ribbon', '#FFE94A', .2, .35))

def setm(o, m):
    o.data.materials.clear(); o.data.materials.append(m)
def smooth(o):
    for p in o.data.polygons: p.use_smooth = True
def apply_mods(o):
    bpy.context.view_layer.objects.active = o
    for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
def bevel(o, w, seg=2):
    b = o.modifiers.new('b', 'BEVEL'); b.width = w; b.segments = seg; b.limit_method = 'ANGLE'; apply_mods(o)
def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join()
    o = bpy.context.active_object; o.name = name
    bpy.context.scene.cursor.location = (0, 0, 0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); return o
def prim(kind, m, **kw):
    getattr(bpy.ops.mesh, 'primitive_' + kind + '_add')(**kw); o = bpy.context.active_object; setm(o, m); smooth(o); return o
def lathe(name, prof, m, steps=96):
    bm = bmesh.new(); vs = [bm.verts.new((r, 0, z)) for r, z in prof]
    for a, b in zip(vs, vs[1:]): bm.edges.new((a, b))
    bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=steps, use_merge=True)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); setm(o, m); smooth(o); return o

# ---------------- base: turned pedestal (top at z=0, radius 2.06 under the glass) ----------------
prof = [(0, -.66), (2.30, -.66), (2.34, -.64), (2.34, -.58), (2.28, -.55), (2.18, -.50), (2.14, -.40), (2.16, -.30), (2.20, -.24), (2.20, -.18), (2.12, -.14), (2.08, -.06), (2.10, -.02), (2.10, 0), (0, 0)]
base = lathe('BaseBody', prof, M['lacq'])
r1 = prim('torus', M['gold'], major_radius=2.215, minor_radius=.035, major_segments=128, minor_segments=10, location=(0, 0, -.21))
r2 = prim('torus', M['gold'], major_radius=2.33, minor_radius=.025, major_segments=128, minor_segments=8, location=(0, 0, -.6))
r3 = prim('torus', M['gold'], major_radius=2.08, minor_radius=.045, major_segments=128, minor_segments=10, location=(0, 0, .0))
join([base, r1, r2, r3], 'DomeBase')

# ---------------- cottage (front gable faces +X in three's house group: door on local +z) ----------------
hw, hd, wh = .3, .24, .34
walls = prim('cube', M['wall'], size=1, location=(0, 0, wh / 2)); walls.scale = (hw * 2, hd * 2, wh); bpy.ops.object.transform_apply(scale=True); bevel(walls, .012)
# roof: two slabs along the ridge (ridge runs along three z → blender -y)
roofs, snows = [], []
for s in (1, -1):
    r = prim('cube', M['roof'], size=1, location=(s * .19, 0, wh + .13)); r.scale = (.46, hd * 2 + .16, .045); r.rotation_euler = (0, s * math.atan2(.26, .37), 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True); bevel(r, .01); roofs.append(r)
    sn = prim('cube', M['snow'], size=1, location=(s * .175, 0, wh + .165)); sn.scale = (.42, hd * 2 + .18, .05); sn.rotation_euler = (0, s * math.atan2(.26, .37), 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True); bevel(sn, .022, 3); snows.append(sn)
gable = []
for s in (1, -1):
    bm = bmesh.new(); yy = s * hd
    v = [bm.verts.new(p) for p in [(-hw, yy, wh), (hw, yy, wh), (0, yy, wh + .26)]]; bm.faces.new(v if s < 0 else v[::-1])
    me = bpy.data.meshes.new('g'); bm.to_mesh(me); bm.free(); g = bpy.data.objects.new('g', me); bpy.context.collection.objects.link(g); setm(g, M['wall']); gable.append(g)
door = prim('cube', M['navy'], size=1, location=(-.12, -(hd + .006), .11)); door.scale = (.11, .015, .2); bpy.ops.object.transform_apply(scale=True); bevel(door, .006)
win = prim('cube', M['win'], size=1, location=(.12, -(hd + .006), .2)); win.scale = (.13, .012, .12); bpy.ops.object.transform_apply(scale=True)
frame = []
for (sx, sz, x, z) in ((.15, .02, .12, .27), (.15, .02, .12, .13), (.02, .15, .05, .2), (.02, .15, .19, .2), (.012, .12, .12, .2), (.13, .012, .12, .2)):
    f = prim('cube', M['wall'], size=1, location=(x, -(hd + .016), z)); f.scale = (sx, .015, sz); bpy.ops.object.transform_apply(scale=True); frame.append(f)
chim = prim('cube', M['navy'], size=1, location=(.16, .05, wh + .22)); chim.scale = (.07, .07, .2); bpy.ops.object.transform_apply(scale=True); bevel(chim, .008)
chs = prim('uv_sphere', M['snow'], radius=.05, segments=12, ring_count=6, location=(.16, .05, wh + .33)); chs.scale = (1, 1, .5); bpy.ops.object.transform_apply(scale=True)
join([walls] + roofs + snows + gable + [door, win, chim, chs] + frame, 'Cottage')

# ---------------- snowy pine (unit size; three scales it) ----------------
tiers = []
for (r, h, z) in ((.32, .36, .26), (.26, .32, .46), (.19, .28, .64), (.12, .22, .8)):
    c = prim('cone', M['pine'], vertices=10, radius1=r, radius2=0, depth=h, location=(0, 0, z))
    for v in c.data.vertices:
        if v.co.z < -h / 2 + 1e-3: v.co.z += random.uniform(-.02, .02)
    s = prim('cone', M['snow'], vertices=10, radius1=r * .62, radius2=0, depth=h * .5, location=(0, 0, z + h * .26)); tiers += [c, s]
tr = prim('cylinder', M['bark'], vertices=8, radius=.045, depth=.16, location=(0, 0, .08))
join(tiers + [tr], 'Pine')

# ---------------- gift with ribbon and a bow ----------------
gs = .13
bx = prim('cube', M['gblue'], size=1, location=(0, 0, gs * .8)); bx.scale = (gs * 2, gs * 2, gs * 1.6); bpy.ops.object.transform_apply(scale=True); bevel(bx, .012, 2)
rb1 = prim('cube', M['ribbon'], size=1, location=(0, 0, gs * .8)); rb1.scale = (gs * 2.03, .045, gs * 1.63); bpy.ops.object.transform_apply(scale=True)
rb2 = prim('cube', M['ribbon'], size=1, location=(0, 0, gs * .8)); rb2.scale = (.045, gs * 2.03, gs * 1.63); bpy.ops.object.transform_apply(scale=True)
loops = []
for s in (1, -1):
    t = prim('torus', M['ribbon'], major_radius=.05, minor_radius=.016, major_segments=20, minor_segments=8, location=(s * .045, 0, gs * 1.6 + .04)); t.rotation_euler = (math.pi / 2, s * .5, 0); t.scale = (1, .7, 1); bpy.ops.object.transform_apply(scale=True, rotation=True); loops.append(t)
knot = prim('uv_sphere', M['ribbon'], radius=.025, segments=12, ring_count=8, location=(0, 0, gs * 1.6 + .025))
join([bx, rb1, rb2, knot] + loops, 'Gift')

tris = 0
for o in bpy.data.objects:
    if o.type == 'MESH': o.data.calc_loop_triangles(); n = len(o.data.loop_triangles); tris += n; print(o.name, n)
print('TRIS', tris)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True, export_texcoords=False, export_normals=True, export_vertex_color='NONE')
